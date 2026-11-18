import { CurrencyPipe, DatePipe, DecimalPipe, formatCurrency } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { describeApiError } from '../../../core/http/api-error';
import { currentLocale, translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AvailabilityDay, AvailabilityGrid, BulkAvailabilityRequest, RoomAvailability } from '../../../core/models/availability';
import { Hotel } from '../../../core/models/hotel';
import { AvailabilityService } from '../../../core/services/availability.service';
import { HotelService } from '../../../core/services/hotel.service';
import { addDays, eachDay, isWeekend, parseIsoDate, today } from '../../../core/utils/dates';
import { EmptyState } from '../../../shared/empty-state';
import { Icon } from '../../../shared/icon';
import { SkeletonRows } from '../../../shared/skeleton';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

// Monday first, as in Spain; values are Date.getDay() numbers (0 = Sunday), which is what the API expects.
// Labels come from the browser's Intl API in the current locale (Mon/lun...), so they need no dictionary.
// 2024-01-01 was a Monday: adding 0..6 days gives Monday..Sunday.
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
  const date = parseIsoDate(addDays('2024-01-01', offset));
  return { value: date.getDay(), label: date.toLocaleDateString(currentLocale, { weekday: 'short' }) };
});

type CellLevel = 'empty' | 'closed' | 'low' | 'mid' | 'high' | 'full';

// Inventory "calendar" of one hotel: rooms in rows, nights in columns, each cell coloured by
// how full it is. It's the view hotel operations actually use - a table of numbers per night
// is hard to scan; colours make the tight nights jump out.
@Component({
  selector: 'app-hotel-availability',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, TranslatePipe, Icon, EmptyState, SkeletonRows],
  templateUrl: './hotel-availability.html',
  styleUrl: './hotel-availability.css',
})
export class HotelAvailability implements OnInit {
  private readonly hotelService = inject(HotelService);
  private readonly availabilityService = inject(AvailabilityService);
  private readonly snackbar = inject(SnackbarService);

  readonly id = input.required<string>(); // :id route param
  private readonly hotelId = computed(() => Number(this.id()));

  readonly rangeOptions = [7, 14, 21, 31];
  readonly weekDays = WEEK_DAYS;
  readonly minDate = today();

  readonly hotel = signal<Hotel | null>(null);
  readonly grid = signal<AvailabilityGrid | null>(null);
  readonly from = signal(today());
  readonly rangeDays = signal(14);
  readonly to = computed(() => addDays(this.from(), this.rangeDays() - 1));
  readonly dates = computed(() => eachDay(this.from(), this.to()));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ----- Bulk load form -----
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  // Sets in signals (not one FormControl per checkbox): the number of rooms depends on the hotel.
  readonly selectedRooms = signal<Set<number>>(new Set());
  readonly selectedDays = signal<Set<number>>(new Set());

  readonly form = inject(NonNullableFormBuilder).group({
    from: [today(), Validators.required],
    to: [addDays(today(), 29), Validators.required],
    totalRooms: [10, [Validators.required, Validators.min(0), Validators.max(1000)]],
    price: [null as number | null, Validators.min(0)],
    resetPrice: [false],
  });

  // Totals per column (night) across all rooms: the hotel-level picture for each night.
  readonly nightTotals = computed(() => {
    const grid = this.grid();
    if (!grid) return [];
    return this.dates().map((_, i) => {
      let total = 0;
      let booked = 0;
      for (const room of grid.rooms) {
        const day = room.days[i];
        if (day) {
          total += day.totalRooms;
          booked += day.bookedRooms;
        }
      }
      return { total, booked, available: total - booked, occupancy: total ? booked / total : null };
    });
  });

  constructor() {
    // "Back to base price" and a special price are mutually exclusive: disable the price input.
    this.form.controls.resetPrice.valueChanges.subscribe((reset) => {
      const price = this.form.controls.price;
      if (reset) price.disable();
      else price.enable();
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.hotel.set(await this.hotelService.getHotel(this.hotelId()));
    } catch (err) {
      this.error.set(describeApiError(err, 'hotels.detail.notFound'));
      return;
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.grid.set(await this.availabilityService.getGrid(this.hotelId(), this.from(), this.to()));
    } catch (err) {
      this.error.set(describeApiError(err, 'availability.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  // ----- Navigation -----

  shift(direction: 1 | -1): void {
    this.from.update((d) => addDays(d, direction * this.rangeDays()));
    this.load();
  }

  goToday(): void {
    this.from.set(today());
    this.load();
  }

  setFrom(value: string): void {
    if (!value) return;
    this.from.set(value);
    this.load();
  }

  setRange(value: string): void {
    this.rangeDays.set(Number(value));
    this.load();
  }

  // ----- Cell helpers -----

  isWeekend(date: string): boolean {
    return isWeekend(date);
  }

  // Thresholds chosen for operations: under 50% nothing to watch, 80%+ "almost full", 100% sold out.
  level(day: AvailabilityDay | null): CellLevel {
    if (!day) return 'empty';
    if (day.totalRooms === 0) return 'closed';
    const occupancy = day.bookedRooms / day.totalRooms;
    if (occupancy >= 1) return 'full';
    if (occupancy >= 0.8) return 'high';
    if (occupancy >= 0.5) return 'mid';
    return 'low';
  }

  cellTitle(room: RoomAvailability, day: AvailabilityDay | null, date: string): string {
    const shownDate = parseIsoDate(date).toLocaleDateString(currentLocale);
    if (!day) return translate('availability.cellNotLoaded', { room: room.roomTypeName, date: shownDate });
    const price = formatCurrency(day.price, currentLocale, '€', 'EUR');
    return [
      `${room.roomTypeName} - ${shownDate}`,
      translate('availability.cellDetail', { available: day.availableRooms, total: day.totalRooms, booked: day.bookedRooms }),
      translate('availability.cellPrice', { price }) + (day.priceOverridden ? ` ${translate('availability.cellSpecial')}` : ''),
    ].join('\n');
  }

  // ----- Bulk load -----

  openForm(): void {
    const grid = this.grid();
    this.form.reset({
      from: this.from() < this.minDate ? this.minDate : this.from(),
      to: addDays(this.from() < this.minDate ? this.minDate : this.from(), 29),
      totalRooms: 10,
      price: null,
      resetPrice: false,
    });
    this.selectedRooms.set(new Set(grid?.rooms.map((r) => r.roomId) ?? []));
    this.selectedDays.set(new Set());
    this.formError.set(null);
    this.formOpen.set(true);
  }

  // Clicking a cell opens the form pre-filled for that room and night: the quickest way to fix one value.
  editCell(room: RoomAvailability, day: AvailabilityDay | null, date: string): void {
    if (date < this.minDate) {
      this.snackbar.show(translate('availability.pastNights'), 'warning');
      return;
    }
    this.form.reset({
      from: date,
      to: date,
      totalRooms: day?.totalRooms ?? 10,
      price: day?.priceOverridden ? day.price : null,
      resetPrice: false,
    });
    this.selectedRooms.set(new Set([room.roomId]));
    this.selectedDays.set(new Set());
    this.formError.set(null);
    this.formOpen.set(true);
  }

  toggleRoom(id: number): void {
    this.selectedRooms.update((set) => toggle(set, id));
  }

  toggleDay(value: number): void {
    this.selectedDays.update((set) => toggle(set, value));
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedRooms().size === 0) {
      this.formError.set(translate('availability.selectRoom'));
      return;
    }

    const value = this.form.getRawValue();
    if (value.to < value.from) {
      this.formError.set(translate('availability.toBeforeFrom'));
      return;
    }

    const request: BulkAvailabilityRequest = {
      roomIds: [...this.selectedRooms()],
      from: value.from,
      to: value.to,
      daysOfWeek: [...this.selectedDays()],
      totalRooms: Number(value.totalRooms),
      // Empty price input = keep current prices; a number = special price for those nights.
      price: value.resetPrice || value.price === null ? null : Number(value.price),
      resetPrice: value.resetPrice,
    };

    this.saving.set(true);
    this.formError.set(null);
    try {
      const result = await this.availabilityService.bulkLoad(this.hotelId(), request);
      this.snackbar.show(translate('availability.saved', { created: result.created, updated: result.updated }), 'success');
      this.formOpen.set(false);
      await this.load();
    } catch (err) {
      // 409 when the new number of rooms is below what's already booked on some night.
      this.formError.set(describeApiError(err, 'availability.failed'));
    } finally {
      this.saving.set(false);
    }
  }
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  // New Set instead of mutating: signals compare by reference, a mutated Set wouldn't notify.
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
