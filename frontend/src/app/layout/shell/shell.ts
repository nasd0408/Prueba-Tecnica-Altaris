import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

interface NavSection {
  title: string;
  items: { label: string; path: string }[];
}

// Frame for the private area: fixed sidebar + top bar + scrollable content.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);

  // Menu defined as data: adding a module (inventory, reservations...) is one line here.
  protected readonly navigation: NavSection[] = [
    { title: 'Overview', items: [{ label: 'Dashboard', path: '/dashboard' }] },
    { title: 'Catalogue', items: [{ label: 'Hotels', path: '/hotels' }] },
  ];

  protected initials(): string {
    return this.auth.userName().slice(0, 2).toUpperCase();
  }
}
