import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

/**
 * In-app confirmation dialog: `if (await confirm.ask({...})) { ... }`.
 * Replaces window.confirm(), which can't be styled or translated (its buttons are in the
 * browser's language) and blocks the whole page. Promise-based, so the calling code reads
 * the same as with the native one.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(request: ConfirmRequest): Promise<boolean> {
    // Only one dialog at a time: a new question answers the previous one with "no".
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...request, resolve }));
  }

  answer(confirmed: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.resolve(confirmed);
  }
}
