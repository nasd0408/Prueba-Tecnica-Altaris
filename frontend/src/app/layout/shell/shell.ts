import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon, IconName } from '../../shared/icon';
import { LanguageSwitch } from '../../shared/language-switch';

interface NavSection {
  title: string;
  items: { label: string; path: string; icon: IconName }[];
}

const COLLAPSED_KEY = 'altairis.sidebarCollapsed';

// Frame for the private area: sidebar + top bar + scrollable content.
// Desktop: the sidebar can collapse to icons only (more room for wide tables like the
// availability grid); the choice is remembered. Small screens: the sidebar is hidden and
// opens over the content from the menu button.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitch, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: {
    '[class.collapsed]': 'collapsed()',
    '[class.mobile-open]': 'mobileOpen()',
  },
})
export class Shell {
  protected readonly auth = inject(AuthService);

  protected readonly collapsed = signal(localStorage.getItem(COLLAPSED_KEY) === '1');
  protected readonly mobileOpen = signal(false);

  // Menu defined as data: adding a module is one line here. Titles and labels are i18n keys.
  protected readonly navigation: NavSection[] = [
    { title: 'nav.overview', items: [{ label: 'nav.dashboard', path: '/dashboard', icon: 'dashboard' }] },
    {
      title: 'nav.operations',
      items: [
        { label: 'nav.today', path: '/today', icon: 'today' },
        { label: 'nav.reservations', path: '/reservations', icon: 'reservations' },
        { label: 'nav.inventory', path: '/inventory', icon: 'inventory' },
        { label: 'nav.hotels', path: '/hotels', icon: 'hotels' },
      ],
    },
    {
      title: 'nav.catalogues',
      items: [
        { label: 'nav.roomTypes', path: '/catalogues/room-types', icon: 'bed' },
        { label: 'nav.amenities', path: '/catalogues/amenities', icon: 'amenities' },
      ],
    },
  ];

  constructor() {
    // After each navigation: close the mobile menu and start the new page at the top.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
        document.querySelector('.content')?.scrollTo({ top: 0 });
      });
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
    localStorage.setItem(COLLAPSED_KEY, this.collapsed() ? '1' : '0');
  }

  protected initials(): string {
    return this.auth.userName().slice(0, 2).toUpperCase();
  }
}
