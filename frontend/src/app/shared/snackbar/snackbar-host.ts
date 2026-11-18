import { Component, inject } from '@angular/core';

import { SnackbarService } from './snackbar.service';

// Rendered once in the root component, so messages survive navigation between pages.
@Component({
  selector: 'app-snackbar-host',
  template: `
    <div class="snackbar-stack" aria-live="polite">
      @for (m of snackbar.messages(); track m.id) {
        <div [class]="'snackbar snackbar-' + m.kind" role="status">
          <span>{{ m.text }}</span>
          <button type="button" class="snackbar-close" (click)="snackbar.dismiss(m.id)" aria-label="Dismiss">
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .snackbar-stack {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 420px;
    }

    .snackbar {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 12px 10px 14px;
      background: #263238;
      color: #fff;
      border-left: 4px solid var(--primary-light);
      border-radius: 3px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      line-height: 1.4;
    }

    .snackbar-success { border-left-color: var(--success); }
    .snackbar-warning { border-left-color: var(--warning); }
    .snackbar-error { border-left-color: var(--danger); }

    .snackbar-close {
      margin-left: auto;
      border: 0;
      background: none;
      color: #b0bec5;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }
  `,
})
export class SnackbarHost {
  protected readonly snackbar = inject(SnackbarService);
}
