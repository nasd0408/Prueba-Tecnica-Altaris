import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Frame for the public pages (login, register, password reset): a centered card, no navigation.
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-mark">A</span>
          <span>Altairis <strong>Backoffice</strong></span>
        </div>
        <router-outlet />
      </div>
      <p class="auth-legal">Viajes Altairis &middot; Internal use only</p>
    </div>
  `,
})
export class AuthLayout {}
