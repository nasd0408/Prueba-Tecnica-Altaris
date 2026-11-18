import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { describeApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Reservation } from '../../../core/models/reservation';
import { ReservationAction, ReservationService } from '../../../core/services/reservation.service';
import { today } from '../../../core/utils/dates';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { StatusBadge } from '../../../shared/status-badge';

// i18n key suffix per action: reservations.detail.actions.<key> / .done.<key>
const ACTION_KEYS: Record<ReservationAction, string> = {
  'check-in': 'checkIn',
  'check-out': 'checkOut',
  'no-show': 'noShow',
  cancel: 'cancel',
};

interface ActionButton {
  action: ReservationAction;
  label: string; // i18n key
  primary?: boolean;
  danger?: boolean;
  confirm?: string;
}

@Component({
  selector: 'app-reservation-detail',
  imports: [RouterLink, StatusBadge, CurrencyPipe, DatePipe, TranslatePipe],
  templateUrl: './reservation-detail.html',
  styleUrl: './reservation-detail.css',
})
export class ReservationDetail implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly snackbar = inject(SnackbarService);

  readonly id = input.required<string>(); // :id route param

  readonly reservation = signal<Reservation | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  // Only the actions that make sense for the current status and date are shown.
  // Same rules as ReservationService in the API (which is the one that really enforces them);
  // mirroring them here avoids offering buttons that would only return an error.
  readonly actions = computed<ActionButton[]>(() => {
    const r = this.reservation();
    if (!r) return [];
    const now = today();
    switch (r.status) {
      case 'Confirmed': {
        const list: ActionButton[] = [];
        if (now >= r.checkIn && now < r.checkOut) list.push({ action: 'check-in', label: 'reservations.detail.actions.checkIn', primary: true });
        if (now >= r.checkIn) list.push({ action: 'no-show', label: 'reservations.detail.actions.noShow', confirm: translate('reservations.detail.confirmNoShow') });
        if (now <= r.checkIn)
          list.push({ action: 'cancel', label: 'reservations.detail.actions.cancel', danger: true, confirm: translate('reservations.detail.confirmCancel', { code: r.code }) });
        return list;
      }
      case 'CheckedIn':
        return [{ action: 'check-out', label: 'reservations.detail.actions.checkOut', primary: true }];
      default:
        return []; // CheckedOut, Cancelled and NoShow are final states
    }
  });

  async ngOnInit(): Promise<void> {
    try {
      this.reservation.set(await this.reservationService.getReservation(Number(this.id())));
    } catch (err) {
      this.error.set(describeApiError(err, 'reservations.detail.notFound'));
    }
  }

  async run(button: ActionButton): Promise<void> {
    const r = this.reservation();
    if (!r) return;
    // Native confirm for destructive actions: simple, accessible, and impossible to miss.
    if (button.confirm && !window.confirm(button.confirm)) return;

    this.busy.set(true);
    try {
      this.reservation.set(await this.reservationService.runAction(r.id, button.action));
      this.snackbar.show(translate(`reservations.detail.done.${ACTION_KEYS[button.action]}`, { code: r.code }), 'success');
    } catch (err) {
      this.snackbar.show(describeApiError(err, 'reservations.detail.actionFailed'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
