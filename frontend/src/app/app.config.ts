import { registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import localeEs from '@angular/common/locales/es';
import { ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { reloadOnChunkError } from './core/chunk-reload';
import { currentLocale } from './core/i18n/translate';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';

// Locale data for Angular's date/number/currency pipes. Only the two languages we offer.
registerLocaleData(localeEnGb);
registerLocaleData(localeEs);

// No provideHttpClient: HTTP goes through axios (core/http/api-client.ts).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route params (e.g. :id) arrive as component inputs, no need to read ActivatedRoute by hand.
    // If a page file from an old deploy can't be loaded, reload the app instead of a blank page.
    provideRouter(routes, withComponentInputBinding(), withNavigationErrorHandler(reloadOnChunkError)),
    // Route titles are i18n keys; this strategy translates them for the browser tab.
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    // Set once at startup from the chosen language: "10,000 / €85.00" vs "10.000 / 85,00 €".
    { provide: LOCALE_ID, useValue: currentLocale },
    // All prices are in euros, so `| currency` doesn't need the code in every template.
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' },
  ],
};
