import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitch } from '../../shared/language-switch';

interface NavSection {
  title: string;
  items: { label: string; path: string }[];
}

// Frame for the private area: fixed sidebar + top bar + scrollable content.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitch],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);

  // Menu defined as data: adding a module (inventory, reservations...) is one line here.
  // Titles and labels are i18n keys.
  protected readonly navigation: NavSection[] = [
    { title: 'nav.overview', items: [{ label: 'nav.dashboard', path: '/dashboard' }] },
    {
      title: 'nav.operations',
      items: [
        { label: 'nav.today', path: '/today' },
        { label: 'nav.reservations', path: '/reservations' },
        { label: 'nav.inventory', path: '/inventory' },
        { label: 'nav.hotels', path: '/hotels' },
      ],
    },
    {
      title: 'nav.catalogues',
      items: [
        { label: 'nav.roomTypes', path: '/catalogues/room-types' },
        { label: 'nav.amenities', path: '/catalogues/amenities' },
      ],
    },
  ];

  protected initials(): string {
    return this.auth.userName().slice(0, 2).toUpperCase();
  }
}
