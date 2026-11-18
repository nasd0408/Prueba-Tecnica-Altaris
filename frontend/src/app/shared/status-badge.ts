import { Component, computed, input } from '@angular/core';

import { translate } from '../core/i18n/translate';
import { ReservationStatus } from '../core/models/reservation';

// One component for the reservation status so list, detail and daily views use the same
// label and colour for each status.
@Component({
  selector: 'app-status-badge',
  template: `<span [class]="'badge status-' + status()">{{ label() }}</span>`,
  styles: `
    .status-Confirmed { background: var(--primary-soft); color: var(--primary); }
    .status-CheckedIn { background: var(--success-soft); color: var(--success); }
    .status-CheckedOut { background: #eceff3; color: var(--text-muted); }
    .status-Cancelled { background: var(--danger-soft); color: var(--danger); }
    .status-NoShow { background: var(--warning-soft); color: var(--warning); }
  `,
})
export class StatusBadge {
  readonly status = input.required<ReservationStatus>();
  readonly label = computed(() => translate(`status.${this.status()}`));
}
