import { Component } from '@angular/core';

import { Lang, currentLang, setLanguage } from '../core/i18n/translate';

@Component({
  selector: 'app-language-switch',
  template: `
    <div class="switch" role="group" aria-label="Language / Idioma">
      @for (l of languages; track l.code) {
        <button
          type="button"
          [class.on]="l.code === current"
          [attr.aria-pressed]="l.code === current"
          [title]="l.name"
          (click)="change(l.code)"
        >
          {{ l.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .switch {
      display: inline-flex;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      overflow: hidden;
    }
    button {
      height: 26px;
      padding: 0 9px;
      border: 0;
      background: var(--surface);
      color: var(--text-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button + button {
      border-left: 1px solid var(--border-strong);
    }
    button.on {
      background: var(--primary);
      color: #fff;
    }
  `,
})
export class LanguageSwitch {
  // Language names in their own language: someone who can't read the current one still finds theirs.
  readonly languages: { code: Lang; label: string; name: string }[] = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'es', label: 'ES', name: 'Español' },
  ];
  readonly current = currentLang;

  change(lang: Lang): void {
    setLanguage(lang);
  }
}
