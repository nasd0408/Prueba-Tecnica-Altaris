import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitch } from '../../shared/language-switch';

// Frame for the public pages (login, register, password reset): a centered card, no navigation.
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TranslatePipe, LanguageSwitch],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-mark">A</span>
          <span>Altairis <strong>Backoffice</strong></span>
          <app-language-switch class="auth-lang" />
        </div>
        <router-outlet />
      </div>
      <p class="auth-legal">{{ 'auth.legal' | t }}</p>
    </div>
  `,
})
export class AuthLayout {}
