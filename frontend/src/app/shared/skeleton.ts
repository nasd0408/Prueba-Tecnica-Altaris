import { Component, computed, input } from '@angular/core';

// Placeholder rows shown while a table loads. Better than a "Loading..." line: the layout
// doesn't jump when the data arrives and the user already sees the shape of the result.
@Component({
  selector: 'app-skeleton-rows',
  template: `
    <div class="skeleton-table" aria-busy="true" [attr.aria-label]="label()">
      @for (row of rowList(); track row) {
        <div class="skeleton-row">
          @for (col of colList(); track col) {
            <span class="skeleton" [style.width.%]="widthFor(row, col)"></span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .skeleton-table {
      padding: 4px 0;
    }
    .skeleton-row {
      display: flex;
      gap: 24px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .skeleton-row:last-child {
      border-bottom: 0;
    }
  `,
})
export class SkeletonRows {
  readonly rows = input(6);
  readonly columns = input(5);
  readonly label = input('Loading');

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  protected readonly colList = computed(() => Array.from({ length: this.columns() }, (_, i) => i));

  // Slightly different widths per cell so it reads as "text", not as a grid of bars.
  protected widthFor(row: number, col: number): number {
    return 40 + ((row * 7 + col * 13) % 50);
  }
}
