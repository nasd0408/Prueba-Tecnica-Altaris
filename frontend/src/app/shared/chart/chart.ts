import { Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

// Chart.js is tree-shakeable: register only what we use instead of importing 'chart.js/auto'
// (which pulls every chart type into the bundle).
Chart.register(BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

// Same neutral look for every chart in the app.
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.color = '#5f6b7a';

/**
 * Thin wrapper around Chart.js (no ng2-charts): the parent passes a full Chart.js config.
 * Keeps the component dumb and the library API visible, which makes it easy to follow and debug.
 */
@Component({
  selector: 'app-chart',
  template: `<div class="chart-box" [style.height.px]="height()"><canvas #canvas></canvas></div>`,
  styles: `.chart-box { position: relative; width: 100%; }`,
})
export class ChartView {
  readonly config = input.required<ChartConfiguration>();
  readonly height = input(260);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    // afterRenderEffect (not effect): Chart.js needs the <canvas> to exist in the DOM.
    // It re-runs whenever the config signal changes; recreating the chart is simpler than
    // diffing datasets, and these charts are tiny.
    afterRenderEffect(() => {
      const config = this.config();
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, {
        ...config,
        options: { responsive: true, maintainAspectRatio: false, ...config.options },
      });
    });

    // Release the canvas and listeners when the page is left.
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
