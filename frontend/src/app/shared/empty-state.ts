import { Component, input } from '@angular/core';

import { Icon, IconName } from './icon';

// "Nothing here" message with an icon, an explanation and, optionally, the next step
// (projected content, e.g. a button). An empty table with no explanation looks broken;
// this tells the user why it's empty and what to do.
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="empty-state">
      <span class="icon-wrap"><app-icon [name]="icon()" [size]="22" /></span>
      <p class="title">{{ title() }}</p>
      @if (text()) {
        <p class="text">{{ text() }}</p>
      }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 36px 16px;
      text-align: center;
    }
    .icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-bottom: 4px;
      border-radius: 50%;
      background: var(--surface-alt);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .title {
      margin: 0;
      font-weight: 600;
    }
    .text {
      margin: 0;
      max-width: 420px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .actions:not(:empty) {
      margin-top: 8px;
    }
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly text = input<string>();
}
