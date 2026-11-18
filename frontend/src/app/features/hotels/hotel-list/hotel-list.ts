import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { fromAbortable } from '../../../core/http/abortable';
import { describeApiError } from '../../../core/http/api-error';
import { Hotel, HotelQuery } from '../../../core/models/hotel';
import { PagedResult } from '../../../core/models/paged-result';
import { HotelService } from '../../../core/services/hotel.service';

const DEFAULT_PAGE_SIZE = 25;

@Component({
  selector: 'app-hotel-list',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './hotel-list.html',
  styleUrl: './hotel-list.css',
})
export class HotelList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hotelService = inject(HotelService);

  readonly pageSizes = [10, 25, 50, 100];
  readonly starOptions = [1, 2, 3, 4, 5];
  readonly countries = signal<string[]>([]);

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly query = signal<HotelQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  readonly result = signal<PagedResult<Hotel> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // If this fails the country filter is just empty; the list itself still works.
    this.hotelService.getCountries().then((list) => this.countries.set(list), () => {});

    // The URL query string is the single source of truth for the filters.
    // Advantages: back/forward buttons work, refreshing keeps the filters,
    // and a filtered list can be shared by copying the URL.
    this.route.queryParamMap
      .pipe(
        map(parseQuery),
        tap((q) => {
          this.query.set(q);
          // emitEvent: false so syncing the input doesn't trigger a new search (loop).
          this.searchControl.setValue(q.search ?? '', { emitEvent: false });
          this.loading.set(true);
          this.error.set(null);
        }),
        // switchMap unsubscribes from the previous request when filters change, and fromAbortable
        // turns that into a real HTTP abort. A slow old response can never overwrite a newer one.
        switchMap((q) =>
          fromAbortable((signal) => this.hotelService.getHotels(q, signal)).pipe(
            catchError((err) => {
              this.error.set(describeApiError(err, 'Could not load hotels.'));
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

    // Debounce: wait until the user stops typing instead of firing one request per key.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.updateQuery({ search: search.trim() || null, page: null }));
  }

  onCountryChange(value: string): void {
    this.updateQuery({ country: value || null, page: null });
  }

  onStarsChange(value: string): void {
    this.updateQuery({ stars: value || null, page: null });
  }

  onPageSizeChange(value: string): void {
    this.updateQuery({ pageSize: value, page: null });
  }

  goToPage(page: number): void {
    this.updateQuery({ page: page > 1 ? page : null });
  }

  clearFilters(): void {
    this.router.navigate([], { queryParams: {} });
  }

  stars(count: number): string {
    return '★'.repeat(count);
  }

  // Changing a filter only changes the URL; the queryParamMap subscription does the loading.
  // A null value removes the param. Any filter change resets to page 1 (page: null).
  private updateQuery(params: Record<string, string | number | null>): void {
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}

function parseQuery(params: ParamMap): HotelQuery {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  const stars = Number(params.get('stars'));

  // URLs can be edited by hand, so anything invalid falls back to a default.
  return {
    search: params.get('search') ?? undefined,
    country: params.get('country') ?? undefined,
    stars: stars >= 1 && stars <= 5 ? stars : undefined,
    page: page > 0 ? page : 1,
    pageSize: pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
  };
}
