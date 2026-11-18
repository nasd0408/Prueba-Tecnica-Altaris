import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

// No provideHttpClient: HTTP goes through axios (core/http/api-client.ts).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route params (e.g. :id) arrive as component inputs, no need to read ActivatedRoute by hand.
    provideRouter(routes, withComponentInputBinding()),
  ],
};
