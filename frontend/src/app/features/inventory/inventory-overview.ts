import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';

import { describeApiError } from '../../core/http/api-error';
import { currentLocale, translate } from '../../core/i18n/translate';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { InventoryOverview } from '../../core/models/availability';
import { AvailabilityService } from '../../core/services/availability.service';
import { HotelService } from '../../core/services/hotel.service';
import { addDays, parseIsoDate, today } from '../../core/utils/dates';
import { ChartView } from '../../shared/chart/chart';
import { EmptyState } from '../../shared/empty-state';
import { SkeletonRows } from '../../shared/skeleton';

// Cross-hotel inventory: how full the whole portfolio is night by night, and which hotels are
// about to run out. Filters live in the URL like in the hotel list (shareable, survive refresh).
@Component({
  selector: 'app-inventory-overview',
  imports: [ChartView, RouterLink, DecimalPipe, DatePipe, TranslatePipe, EmptyState, SkeletonRows],
  templateUrl: './inventory-overview.html',
  styleUrl: './inventory-overview.css',
})
export class InventoryOverviewPage implements OnInit {
  private readonly availabilityService = inject(AvailabilityService);
  private readonly hotelService = inject(HotelService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly rangeOptions = [7, 14, 30];
  readonly countries = signal<string[]>([]);

  readonly from = signal(today());
  readonly rangeDays = signal(14);
  readonly country = signal('');
  readonly to = computed(() => addDays(this.from(), this.rangeDays() - 1));

  readonly overview = signal<InventoryOverview | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly occupancy = computed(() => {
    const o = this.overview();
    return o && o.totalRoomNights ? o.bookedRoomNights / o.totalRoomNights : 0;
  });

  // Stacked bars: booked + available = rooms on sale each night. One look shows both the volume
  // and how full it is; the occupancy % goes in the tooltip.
  readonly chart = computed<ChartConfiguration | null>(() => {
    const o = this.overview();
    if (!o) return null;
    const labels = o.days.map((d) =>
      parseIsoDate(d.date).toLocaleDateString(currentLocale, { weekday: 'short', day: 'numeric', month: 'short' }),
    );
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: translate('inventory.datasetBooked'), data: o.days.map((d) => d.bookedRooms), backgroundColor: '#0b5cad', stack: 'rooms' },
          {
            label: translate('inventory.datasetAvailable'),
            data: o.days.map((d) => d.totalRooms - d.bookedRooms),
            backgroundColor: '#c9daec',
            stack: 'rooms',
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: {
            callbacks: {
              footer: (items) => {
                const day = o.days[items[0].dataIndex];
                const pct = day.totalRooms ? Math.round((day.bookedRooms / day.totalRooms) * 100) : 0;
                return translate('inventory.tooltip', { pct, soldOut: day.soldOutRooms });
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#eef0f3' } },
        },
      },
    };
  });

  ngOnInit(): void {
    this.hotelService.getCountries().then((list) => this.countries.set(list), () => {});

    // Read filters from the URL once, then every change writes the URL and reloads.
    const params = this.route.snapshot.queryParamMap;
    const from = params.get('from');
    const days = Number(params.get('days'));
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) this.from.set(from);
    if (this.rangeOptions.includes(days)) this.rangeDays.set(days);
    this.country.set(params.get('country') ?? '');

    this.load();
  }

  update(changes: { from?: string; days?: number; country?: string }): void {
    if (changes.from) this.from.set(changes.from);
    if (changes.days) this.rangeDays.set(changes.days);
    if (changes.country !== undefined) this.country.set(changes.country);

    this.router.navigate([], {
      queryParams: { from: this.from(), days: this.rangeDays(), country: this.country() || null },
      replaceUrl: true, // filters tweaks shouldn't fill the back-button history
    });
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.overview.set(
        await this.availabilityService.getOverview(this.from(), this.to(), this.country() || undefined),
      );
    } catch (err) {
      this.error.set(describeApiError(err, 'inventory.failed'));
    } finally {
      this.loading.set(false);
    }
  }

  // Same thresholds as the hotel grid, so colours mean the same everywhere.
  level(occupancy: number): string {
    if (occupancy >= 1) return 'full';
    if (occupancy >= 0.8) return 'high';
    if (occupancy >= 0.5) return 'mid';
    return 'low';
  }
}
