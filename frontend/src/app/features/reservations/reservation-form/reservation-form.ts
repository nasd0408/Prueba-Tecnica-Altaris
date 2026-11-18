import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';

import { fromAbortable } from '../../../core/http/abortable';
import { describeApiError, translateApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Hotel } from '../../../core/models/hotel';
import { Quote } from '../../../core/models/reservation';
import { Room } from '../../../core/models/room';
import { HotelService } from '../../../core/services/hotel.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { RoomService } from '../../../core/services/room.service';
import { addDays, today } from '../../../core/utils/dates';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { StayCalendar, StayRange } from '../stay-calendar/stay-calendar';

// Booking form in three steps on one page: pick the hotel, pick room + dates (a live quote
// shows availability and price per night), then guest details. The "Book" button only enables
// when the quote says it can be booked; the API checks everything again anyway.
@Component({
  selector: 'app-reservation-form',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, TranslatePipe, StayCalendar],
  templateUrl: './reservation-form.html',
  styleUrl: './reservation-form.css',
})
export class ReservationForm implements OnInit {
  private readonly hotelService = inject(HotelService);
  private readonly roomService = inject(RoomService);
  private readonly reservationService = inject(ReservationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly minDate = today();

  // ----- Step 1: hotel -----
  readonly hotelSearch = new FormControl('', { nonNullable: true });
  readonly hotelResults = signal<Hotel[]>([]);
  readonly hotel = signal<Hotel | null>(null);

  // ----- Step 2: room and dates -----
  readonly rooms = signal<Room[]>([]);
  readonly quote = signal<Quote | null>(null);
  readonly quoting = signal(false);
  readonly quoteError = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    roomId: [0, [Validators.required, Validators.min(1)]],
    // Empty on purpose: the user picks the stay in the availability calendar.
    checkIn: ['', Validators.required],
    checkOut: ['', Validators.required],
    rooms: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    guests: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
    guestName: ['', [Validators.required, Validators.maxLength(150)]],
    guestEmail: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    guestPhone: ['', Validators.maxLength(30)],
    notes: ['', Validators.maxLength(500)],
  });

  // The form values as a signal, so the calendar's inputs follow what's typed in the form.
  readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedRoom = computed(() => this.rooms().find((r) => r.id === this.roomIdValue()) ?? null);
  private readonly roomIdValue = signal(0);

  constructor() {
    // Hotel search as you type (debounced), only active hotels: inactive ones can't be booked.
    this.hotelSearch.valueChanges
      .pipe(
        debounceTime(300),
        map((v) => v.trim()),
        distinctUntilChanged(),
        switchMap((search) =>
          search.length < 2
            ? of([])
            : fromAbortable((signal) =>
                this.hotelService.getHotels({ search, isActive: true, page: 1, pageSize: 8 }, signal),
              ).pipe(
                map((r) => r.items),
                catchError(() => of([])),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((hotels) => this.hotelResults.set(hotels));

    // Live quote: whenever room, dates or number of rooms change, ask the API.
    // Debounced so typing a date doesn't fire one request per keystroke; switchMap drops stale answers.
    this.form.valueChanges
      .pipe(
        map((v) => ({ roomId: v.roomId ?? 0, checkIn: v.checkIn ?? '', checkOut: v.checkOut ?? '', rooms: v.rooms ?? 1 })),
        tap((v) => this.roomIdValue.set(Number(v.roomId))),
        debounceTime(250),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap(() => this.quoteError.set(null)),
        filter((v) => {
          const ready = v.roomId > 0 && !!v.checkIn && !!v.checkOut && v.rooms > 0;
          if (!ready) this.quote.set(null);
          return ready;
        }),
        tap(() => this.quoting.set(true)),
        switchMap((v) =>
          fromAbortable((signal) =>
            this.reservationService.quote(Number(v.roomId), v.checkIn, v.checkOut, Number(v.rooms), signal),
          ).pipe(
            catchError((err) => {
              // 400 for invalid dates ("check-out must be after check-in"): show it next to the quote.
              this.quoteError.set(describeApiError(err, 'reservations.form.quoteFailed'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((quote) => {
        this.quote.set(quote);
        this.quoting.set(false);
      });
  }

  async ngOnInit(): Promise<void> {
    // Optional pre-selection from links (e.g. "New reservation" on a hotel page).
    const params = this.route.snapshot.queryParamMap;
    const hotelId = Number(params.get('hotelId'));
    if (hotelId > 0) {
      try {
        await this.selectHotel(await this.hotelService.getHotel(hotelId));
      } catch {
        this.error.set(translate('reservations.form.hotelLoadFailed'));
      }
    }
  }

  async selectHotel(hotel: Hotel): Promise<void> {
    this.hotel.set(hotel);
    this.hotelResults.set([]);
    this.hotelSearch.setValue('', { emitEvent: false });
    this.form.controls.roomId.setValue(0);
    this.rooms.set(await this.roomService.getRooms(hotel.id));
  }

  changeHotel(): void {
    this.hotel.set(null);
    this.rooms.set([]);
    this.quote.set(null);
    this.form.controls.roomId.setValue(0);
  }

  // Dates picked in the calendar go into the form, which triggers the quote as usual.
  onStayChange(range: StayRange | null): void {
    this.form.patchValue({ checkIn: range?.checkIn ?? '', checkOut: range?.checkOut ?? '' });
  }

  // Check-out follows check-in: moving the arrival past the departure pushes the departure.
  onCheckInChange(): void {
    const { checkIn, checkOut } = this.form.getRawValue();
    if (checkIn && checkOut <= checkIn) this.form.controls.checkOut.setValue(addDays(checkIn, 1));
  }

  // The quote's problem comes with the same code + args as an API error ("Only 2 Double left on 29/11").
  problemText(quote: Quote): string {
    return quote.problem ? (translateApiError(quote.problem) ?? '') : '';
  }

  showError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const quote = this.quote();
    if (!quote?.canBook) return;

    const v = this.form.getRawValue();
    if (v.guests > quote.maxGuests) {
      this.error.set(translate('reservations.form.guestsDontFit', { guests: v.guests, max: quote.maxGuests, rooms: v.rooms }));
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const reservation = await this.reservationService.create({
        roomId: Number(v.roomId),
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        rooms: Number(v.rooms),
        guests: Number(v.guests),
        guestName: v.guestName.trim(),
        guestEmail: v.guestEmail.trim(),
        guestPhone: v.guestPhone.trim() || null,
        notes: v.notes.trim() || null,
      });
      this.snackbar.show(translate('reservations.form.confirmed', { code: reservation.code }), 'success');
      await this.router.navigate(['/reservations', reservation.id]);
    } catch (err) {
      // 409 if the nights were taken between the quote and the booking.
      this.error.set(describeApiError(err, 'reservations.form.failed'));
    } finally {
      this.saving.set(false);
    }
  }
}
