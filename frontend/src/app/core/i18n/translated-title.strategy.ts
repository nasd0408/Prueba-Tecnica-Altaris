import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { translate } from './translate';

// Route titles are dictionary keys ("titles.hotels"); this turns them into the browser tab title
// in the current language. Plugged into the router once, so routes stay declarative.
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    this.title.setTitle(key ? `${translate(key)} - Altairis` : 'Altairis Backoffice');
  }
}
