import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';

import { describeApiError } from '../../core/http/api-error';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';
import { ChartView } from '../../shared/chart/chart';

@Component({
  selector: 'app-dashboard',
  imports: [ChartView, RouterLink, DecimalPipe, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly dashboardService = inject(DashboardService);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly error = signal<string | null>(null);

  readonly activeRate = computed(() => {
    const s = this.summary();
    return s && s.totalHotels ? Math.round((s.activeHotels / s.totalHotels) * 100) : 0;
  });

  // Chart configs are derived (computed) from the data: when the summary changes,
  // the charts update by themselves through ChartView's input.
  readonly byCountryChart = computed<ChartConfiguration | null>(() => {
    const s = this.summary();
    if (!s) return null;
    return {
      type: 'bar',
      data: {
        labels: s.hotelsByCountry.map((x) => x.label),
        datasets: [{ label: 'Hotels', data: s.hotelsByCountry.map((x) => x.count), backgroundColor: '#0b5cad' }],
      },
      // Horizontal bars: country names are long and read better on the Y axis.
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: '#eef0f3' } }, y: { grid: { display: false } } },
      },
    };
  });

  readonly byStarsChart = computed<ChartConfiguration | null>(() => {
    const s = this.summary();
    if (!s) return null;
    return {
      type: 'doughnut',
      data: {
        labels: s.hotelsByStars.map((x) => `${x.label} star${x.label === '1' ? '' : 's'}`),
        datasets: [
          {
            data: s.hotelsByStars.map((x) => x.count),
            // Sequential blues: categories are ordered (1 to 5 stars), so one hue getting darker.
            backgroundColor: ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
            borderWidth: 1,
          },
        ],
      },
      options: { cutout: '60%', plugins: { legend: { position: 'right' } } },
    };
  });

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      this.summary.set(await this.dashboardService.getSummary());
    } catch (err) {
      this.error.set(describeApiError(err, 'Could not load the dashboard.'));
    }
  }
}
