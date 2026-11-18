import { Component, computed, input } from '@angular/core';

// Small hand-picked icon set (24x24, 1.75 stroke) instead of an icon font or library:
// ~25 icons are all the app needs, they inherit the text colour (currentColor) and
// add a few KB instead of a whole package.
const ICONS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  today: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4M9 14l2 2 4-4',
  reservations: 'M8 4h8v3H8zM6 6H5v15h14V6h-1M9 12h6M9 16h4',
  inventory: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5',
  hotels: 'M4 21V5l8-2v18M12 7l8 3v11M4 21h16M8 8v.01M8 12v.01M8 16v.01M16 13v.01M16 17v.01',
  bed: 'M3 19v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 15h18M3 19v2M21 19v2M7 9V6h4v3',
  amenities: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  collapse: 'M4 4h16v16H4zM9 4v16M15 9l-3 3 3 3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  alert: 'M12 4 2.5 20h19zM12 10v4M12 17v.01',
  check: 'M5 12l5 5L20 7',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
  calendar: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  login: 'M10 8l4 4-4 4M14 12H4M14 4h5v16h-5',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  protected readonly path = computed(() => ICONS[this.name()]);
}
