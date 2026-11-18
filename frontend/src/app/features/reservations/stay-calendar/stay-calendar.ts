import { formatCurrency } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { describeApiError } from '../../../core/http/api-error';
import { currentLocale, translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AvailabilityDay } from '../../../core/models/availability';
import { AvailabilityService } from '../../../core/services/availability.service';
import {
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  endOfMonth,
  parseIsoDate,
  startOfMonth,
  today,
} from '../../../core/utils/dates';
import { Icon } from '../../../shared/icon';

// Same limit as the API (ReservationService.MaxNights).
const MAX_NIGHTS = 30;

export interface StayRange {
  checkIn: string;
  checkOut: string | null;
}

type DayState = 'past' | 'none' | 'soldout' | 'few' | 'available';

interface CalendarCell {
  date: string;
  dayOfMonth: number;
  state: DayState;
  available: number | null;
  price: string | null;
  selectable: boolean;
  isCheckIn: boolean;
  isCheckOut: boolean;
  inRange: boolean;
  isToday: boolean;
  label: string;
}

interface CalendarMonth {
  key: string;
  title: string;
  // Leading empty slots so the 1st falls on its weekday (Monday-first weeks).
  offset: number[];
  cells: CalendarCell[];
}

/**
 * Two-month availability calendar for one room of a hotel, used to pick the stay.
 * Each night shows free rooms and price, so the user sees at a glance when there's space
 * instead of trying dates one by one. Range selection follows hotel rules:
 *  - check-in must be a night with enough rooms;
 *  - check-out is the day after the last night, so it can be any day up to the first blocked
 *    night (the check-out day itself isn't slept);
 *  - at most MAX_NIGHTS nights.
 * The parent keeps the selected dates (in its form); this component only emits changes.
 */
@Component({
  selector: 'app-stay-calendar',
  imports: [TranslatePipe, Icon],
  templateUrl: './stay-calendar.html',
  styleUrl: './stay-calendar.css',
})
export class StayCalendar {
  private readonly availabilityService = inject(AvailabilityService);

  readonly hotelId = input.required<number>();
  readonly roomId = input.required<number>();
  readonly rooms = input(1); // rooms being booked: a night needs at least this many free
  readonly checkIn = input<string | null>(null);
  readonly checkOut = input<string | null>(null);
  readonly rangeChange = output<StayRange | null>();

  protected readonly todayIso = today();
  protected readonly firstMonth = signal(startOfMonth(today()));
  protected readonly hoverDate = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Nights already loaded for the whole hotel: roomId -> date -> night (null = no inventory).
  // Kept across month changes, so checking a long stay that crosses months still works.
  private readonly cache = signal(new Map<number, Map<string, AvailabilityDay | null>>());
  private loadedHotel: number | null = null;

  // Monday-first weekday names in the current language (Intl, no dictionary needed).
  // 2024-01-01 was a Monday.
  protected readonly weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    parseIsoDate(addDays('2024-01-01', i)).toLocaleDateString(currentLocale, { weekday: 'short' }),
  );

  // Last day that can be chosen as check-out from the current check-in: the first blocked
  // night (sold out, closed, not loaded) or the night limit, whichever comes first.
  protected readonly maxCheckOut = computed(() => {
    const checkIn = this.checkIn();
    if (!checkIn || this.checkOut()) return null;
    let night = checkIn;
    for (let i = 0; i < MAX_NIGHTS; i++) {
      if (!this.nightFits(night)) return night;
      night = addDays(night, 1);
    }
    return night;
  });

  protected readonly months = computed<CalendarMonth[]>(() =>
    [0, 1].map((n) => this.buildMonth(addMonths(this.firstMonth(), n))),
  );

  protected readonly nights = computed(() => {
    const checkIn = this.checkIn();
    const checkOut = this.checkOut();
    return checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0;
  });

  constructor() {
    // Load the two visible months whenever the hotel or the view changes.
    // The response includes every room of the hotel, so switching room type needs no request.
    effect(() => {
      const hotelId = this.hotelId();
      const from = this.firstMonth();
      void this.load(hotelId, from);
    });

    // When a check-in arrives from outside (e.g. typed in the date input), show its month.
    effect(() => {
      const checkIn = this.checkIn();
      if (!checkIn) return;
      const first = this.firstMonth();
      if (checkIn < first || checkIn > endOfMonth(addMonths(first, 1))) {
        this.firstMonth.set(startOfMonth(checkIn));
      }
    });
  }

  protected previousMonth(): void {
    if (this.canGoBack()) this.firstMonth.update((m) => addMonths(m, -1));
  }

  protected nextMonth(): void {
    this.firstMonth.update((m) => addMonths(m, 1));
  }

  protected canGoBack(): boolean {
    return this.firstMonth() > startOfMonth(this.todayIso);
  }

  protected select(cell: CalendarCell): void {
    if (!cell.selectable) return;
    const checkIn = this.checkIn();

    // Second click, later than the check-in: that's the check-out.
    if (checkIn && !this.checkOut() && cell.date > checkIn) {
      this.rangeChange.emit({ checkIn, checkOut: cell.date });
      return;
    }
    // Otherwise start a new selection from this night.
    this.rangeChange.emit({ checkIn: cell.date, checkOut: null });
  }

  protected clear(): void {
    this.rangeChange.emit(null);
  }

  protected hintKey(): string {
    if (!this.checkIn()) return 'reservations.calendar.pickCheckIn';
    if (!this.checkOut()) return 'reservations.calendar.pickCheckOut';
    return '';
  }

  protected formatDate(iso: string): string {
    return parseIsoDate(iso).toLocaleDateString(currentLocale, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  private async load(hotelId: number, from: string): Promise<void> {
    if (this.loadedHotel !== hotelId) {
      this.cache.set(new Map());
      this.loadedHotel = hotelId;
    }

    // Two full months = at most 62 days, which is exactly the API's grid limit.
    const start = from < this.todayIso ? this.todayIso : from;
    const end = endOfMonth(addMonths(from, 1));
    if (start > end) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      const grid = await this.availabilityService.getGrid(hotelId, start, end);
      if (this.loadedHotel !== hotelId) return; // hotel changed while loading
      const dates = eachDay(grid.from, grid.to);
      const next = new Map(this.cache());
      for (const room of grid.rooms) {
        const nights = new Map(next.get(room.roomId) ?? []);
        room.days.forEach((day, i) => nights.set(dates[i], day));
        next.set(room.roomId, nights);
      }
      this.cache.set(next);
    } catch (err) {
      this.error.set(describeApiError(err, 'availability.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  // A night can be part of the stay if it's not past and has enough free rooms.
  private nightFits(date: string): boolean {
    if (date < this.todayIso) return false;
    const day = this.cache().get(this.roomId())?.get(date);
    return !!day && day.totalRooms > 0 && day.availableRooms >= this.rooms();
  }

  private buildMonth(monthStart: string): CalendarMonth {
    const first = parseIsoDate(monthStart);
    const offset = (first.getDay() + 6) % 7; // Monday = 0
    const nights = this.cache().get(this.roomId());
    const checkIn = this.checkIn();
    const checkOut = this.checkOut();
    const maxCheckOut = this.maxCheckOut();
    const hover = this.hoverDate();
    const rooms = this.rooms();

    // While choosing the check-out, preview the stay up to the hovered day.
    const previewEnd = checkIn && !checkOut && hover && hover > checkIn && maxCheckOut && hover <= maxCheckOut ? hover : null;

    const cells = eachDay(monthStart, endOfMonth(monthStart)).map((date): CalendarCell => {
      const day = nights?.get(date);
      const past = date < this.todayIso;

      let state: DayState;
      if (past) state = 'past';
      else if (!day || day.totalRooms === 0) state = 'none';
      else if (day.availableRooms < rooms || day.availableRooms === 0) state = 'soldout';
      else if (day.availableRooms <= 2) state = 'few';
      else state = 'available';

      const fits = state === 'few' || state === 'available';
      const pickingCheckOut = !!checkIn && !checkOut;
      const validCheckOut = pickingCheckOut && date > checkIn! && !!maxCheckOut && date <= maxCheckOut;
      const selectable = validCheckOut || (fits && !past);

      const rangeEnd = checkOut ?? previewEnd;
      const inRange = !!checkIn && !!rangeEnd && date > checkIn && date < rangeEnd;

      const price = day && fits ? formatCurrency(day.price, currentLocale, '€', 'EUR', '1.0-0') : null;

      return {
        date,
        dayOfMonth: parseIsoDate(date).getDate(),
        state,
        available: day ? day.availableRooms : null,
        price,
        selectable,
        isCheckIn: date === checkIn,
        isCheckOut: date === checkOut || date === previewEnd,
        inRange,
        isToday: date === this.todayIso,
        label: this.cellLabel(date, state, day ?? null, price),
      };
    });

    // Only the first letter in capitals: Spanish month names are lower case ("noviembre de 2026").
    const title = first.toLocaleDateString(currentLocale, { month: 'long', year: 'numeric' });
    return {
      key: monthStart,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      offset: Array.from({ length: offset }, (_, i) => i),
      cells,
    };
  }

  // Full sentence for screen readers and the tooltip: "Sat 28 Nov: 2 free, 68 €".
  private cellLabel(date: string, state: DayState, day: AvailabilityDay | null, price: string | null): string {
    const when = this.formatDate(date);
    switch (state) {
      case 'past':
        return when;
      case 'none':
        return `${when}: ${translate('reservations.calendar.noInventory')}`;
      case 'soldout':
        return `${when}: ${translate('reservations.calendar.soldOut')}`;
      default:
        return `${when}: ${translate('reservations.calendar.free', { count: day!.availableRooms })}, ${price}`;
    }
  }
}
