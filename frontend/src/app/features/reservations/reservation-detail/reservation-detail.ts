import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { describeApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Reservation } from '../../../core/models/reservation';
import { ReservationAction, ReservationService } from '../../../core/services/reservation.service';
import { today } from '../../../core/utils/dates';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { Icon, IconName } from '../../../shared/icon';
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
  icon: IconName;
  primary?: boolean;
  danger?: boolean;
  confirm?: { title: string; message: string };
}

@Component({
  selector: 'app-reservation-detail',
  imports: [RouterLink, StatusBadge, CurrencyPipe, DatePipe, TranslatePipe, Icon],
  templateUrl: './reservation-detail.html',
  styleUrl: './reservation-detail.css',
})
export class ReservationDetail implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly confirm = inject(ConfirmService);

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
        if (now >= r.checkIn && now < r.checkOut) list.push({ action: 'check-in', label: 'reservations.detail.actions.checkIn', icon: 'login', primary: true });
        if (now >= r.checkIn) list.push({
            action: 'no-show',
            label: 'reservations.detail.actions.noShow',
            icon: 'alert',
            confirm: { title: translate('reservations.detail.confirmNoShowTitle'), message: translate('reservations.detail.confirmNoShow') },
          });
        if (now <= r.checkIn)
          list.push({
            action: 'cancel',
            label: 'reservations.detail.actions.cancel',
            icon: 'close',
            danger: true,
            confirm: {
              title: translate('reservations.detail.confirmCancelTitle', { code: r.code }),
              message: translate('reservations.detail.confirmCancel'),
            },
          });
        return list;
      }
      case 'CheckedIn':
        return [{ action: 'check-out', label: 'reservations.detail.actions.checkOut', icon: 'logout', primary: true }];
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
    // Actions that can't be undone ask first, in our own dialog (styled and translated).
    if (button.confirm) {
      const ok = await this.confirm.ask({
        ...button.confirm,
        confirmLabel: translate(button.label),
        cancelLabel: translate('common.goBack'),
        danger: button.danger,
      });
      if (!ok) return;
    }

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
