import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { Icon } from '../icon';
import { ConfirmService } from './confirm.service';

// Rendered once in the root component. Uses the native <dialog> element: it gives a real modal
// (focus trapped inside, Esc to close, backdrop, inert page behind) without a UI library.
@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon],
  template: `
    <dialog #dialog class="confirm" (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      @if (confirm.pending(); as p) {
        <div class="body">
          <span class="icon" [class.danger]="p.danger">
            <app-icon [name]="p.danger ? 'alert' : 'info'" [size]="20" />
          </span>
          <div>
            <h2>{{ p.title }}</h2>
            <p>{{ p.message }}</p>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn" (click)="confirm.answer(false)">{{ p.cancelLabel }}</button>
          <button
            type="button"
            class="btn"
            [class.btn-primary]="!p.danger"
            [class.btn-danger-solid]="p.danger"
            (click)="confirm.answer(true)"
            autofocus
          >
            {{ p.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog {
      width: min(440px, calc(100vw - 32px));
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
      color: var(--text);
    }
    dialog::backdrop {
      background: rgba(15, 23, 42, 0.45);
    }
    .body {
      display: flex;
      gap: 14px;
      padding: 20px 20px 8px;
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .icon.danger {
      background: var(--danger-soft);
      color: var(--danger);
    }
    h2 {
      margin: 6px 0 6px;
      font-size: 16px;
    }
    p {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px 20px;
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Open/close the native dialog when a question arrives or is answered.
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.confirm.pending() && !el.open) el.showModal();
      if (!this.confirm.pending() && el.open) el.close();
    });
  }

  // Esc: treat as "cancel" (and let our state close the dialog, not the browser).
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.confirm.answer(false);
  }

  // Click on the backdrop (the dialog element itself, outside its content) = cancel.
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.confirm.answer(false);
  }
}
