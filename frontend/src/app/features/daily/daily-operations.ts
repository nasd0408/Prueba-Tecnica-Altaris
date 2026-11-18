import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';

import { describeApiError } from '../../core/http/api-error';
import { translate } from '../../core/i18n/translate';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DailySummary } from '../../core/models/reservation';
import { ReservationService } from '../../core/services/reservation.service';
import { addDays, today } from '../../core/utils/dates';
import { ChartView } from '../../shared/chart/chart';

const TOP_COUNTRIES = 10;

// "How is today going?" for the operations team: arrivals and departures (and how many are
// still pending), guests in house, and today's sales. Every number links to the reservation
// list with the matching filters, so the user can go from the summary to the actual bookings.
@Component({
  selector: 'app-daily-operations',
  imports: [ChartView, RouterLink, DatePipe, DecimalPipe, CurrencyPipe, TranslatePipe],
  templateUrl: './daily-operations.html',
  styleUrl: './daily-operations.css',
})
export class DailyOperations implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly date = signal(today());
  readonly isToday = computed(() => this.date() === today());
  readonly summary = signal<DailySummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly topCountries = computed(() => this.summary()?.byCountry.slice(0, TOP_COUNTRIES) ?? []);

  // Grouped bars per country: arrivals vs departures, the day's workload at a glance.
  readonly chart = computed<ChartConfiguration | null>(() => {
    const countries = this.topCountries();
    if (!countries.length) return null;
    return {
      type: 'bar',
      data: {
        labels: countries.map((c) => c.country),
        datasets: [
          { label: translate('daily.arrivals'), data: countries.map((c) => c.arrivals), backgroundColor: '#0b5cad' },
          { label: translate('daily.departures'), data: countries.map((c) => c.departures), backgroundColor: '#8fb3d9' },
        ],
      },
      options: {
        plugins: { legend: { position: 'top', align: 'end' } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#eef0f3' } },
        },
      },
    };
  });

  ngOnInit(): void {
    const date = this.route.snapshot.queryParamMap.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.date.set(date);
    this.load();
  }

  setDate(value: string): void {
    if (!value) return;
    this.date.set(value);
    // replaceUrl: moving between days shouldn't fill the back-button history.
    this.router.navigate([], { queryParams: { date: this.isToday() ? null : value }, replaceUrl: true });
    this.load();
  }

  shift(days: number): void {
    this.setDate(addDays(this.date(), days));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.summary.set(await this.reservationService.getDaily(this.date()));
    } catch (err) {
      this.error.set(describeApiError(err, 'daily.failed'));
    } finally {
      this.loading.set(false);
    }
  }

  // Links into the reservation list with the filters that produce each number.
  arrivalsLink(status?: string) {
    return { dateType: 'checkIn', from: this.date(), to: this.date(), status: status ?? null };
  }

  departuresLink(status?: string) {
    return { dateType: 'checkOut', from: this.date(), to: this.date(), status: status ?? null };
  }

  createdLink() {
    return { dateType: 'created', from: this.date(), to: this.date() };
  }
}
