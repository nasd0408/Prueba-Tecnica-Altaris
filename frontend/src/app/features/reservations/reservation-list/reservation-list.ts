import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { fromAbortable } from '../../../core/http/abortable';
import { describeApiError } from '../../../core/http/api-error';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PagedResult } from '../../../core/models/paged-result';
import {
  ReservationDateType,
  ReservationListItem,
  ReservationQuery,
  RESERVATION_STATUSES,
  ReservationStatus,
} from '../../../core/models/reservation';
import { ReservationService } from '../../../core/services/reservation.service';
import { StatusBadge } from '../../../shared/status-badge';

const DEFAULT_PAGE_SIZE = 25;
const STATUSES = RESERVATION_STATUSES;
// Labels: reservations.list.dateTypes.<value> in the i18n dictionaries.
const DATE_TYPES: ReservationDateType[] = ['checkIn', 'checkOut', 'stay', 'created'];

// Same pattern as the hotel list: the URL query string is the single source of truth for the
// filters (shareable links like "today's arrivals", back button works), and the list reloads
// whenever it changes. The daily operations page links here with pre-set filters.
@Component({
  selector: 'app-reservation-list',
  imports: [ReactiveFormsModule, RouterLink, StatusBadge, CurrencyPipe, DatePipe, TranslatePipe],
  templateUrl: './reservation-list.html',
  styleUrl: './reservation-list.css',
})
export class ReservationList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reservationService = inject(ReservationService);

  readonly statuses = STATUSES;
  readonly dateTypes = DATE_TYPES;
  readonly pageSizes = [10, 25, 50, 100];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly query = signal<ReservationQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  readonly result = signal<PagedResult<ReservationListItem> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap
      .pipe(
        map(parseQuery),
        tap((q) => {
          this.query.set(q);
          this.searchControl.setValue(q.search ?? '', { emitEvent: false });
          this.loading.set(true);
          this.error.set(null);
        }),
        // switchMap + fromAbortable: a newer filter cancels the request still in flight.
        switchMap((q) =>
          fromAbortable((signal) => this.reservationService.getReservations(q, signal)).pipe(
            catchError((err) => {
              this.error.set(describeApiError(err, 'reservations.list.failed'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.result.set(result);
        this.loading.set(false);
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.updateQuery({ search: search.trim() || null, page: null }));
  }

  update(params: Record<string, string | number | null>): void {
    this.updateQuery({ ...params, page: null });
  }

  goToPage(page: number): void {
    this.updateQuery({ page: page > 1 ? page : null });
  }

  clearFilters(): void {
    this.router.navigate([], { queryParams: {} });
  }

  private updateQuery(params: Record<string, string | number | null>): void {
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}

function parseQuery(params: ParamMap): ReservationQuery {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  const hotelId = Number(params.get('hotelId'));
  const status = params.get('status') as ReservationStatus | null;
  const dateType = params.get('dateType') as ReservationDateType | null;

  // URLs can be edited by hand, so anything invalid is ignored.
  return {
    search: params.get('search') ?? undefined,
    status: status && STATUSES.includes(status) ? status : undefined,
    hotelId: hotelId > 0 ? hotelId : undefined,
    dateType: dateType && DATE_TYPES.includes(dateType) ? dateType : undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    page: page > 0 ? page : 1,
    pageSize: pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
  };
}
