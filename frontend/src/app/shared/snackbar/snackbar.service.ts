import { Injectable, signal } from '@angular/core';

export type SnackbarKind = 'info' | 'success' | 'warning' | 'error';

export interface SnackbarMessage {
  id: number;
  text: string;
  kind: SnackbarKind;
}

// Tiny in-house snackbar instead of Angular Material: one service + one component, ~60 lines.
// Pulling a full UI kit for a single widget would also bring its look into the whole app.
@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private nextId = 1;
  readonly messages = signal<SnackbarMessage[]>([]);

  show(text: string, kind: SnackbarKind = 'info', durationMs = 6000): void {
    const message = { id: this.nextId++, text, kind };
    this.messages.update((list) => [...list, message]);
    setTimeout(() => this.dismiss(message.id), durationMs);
  }

  dismiss(id: number): void {
    this.messages.update((list) => list.filter((m) => m.id !== id));
  }
}
