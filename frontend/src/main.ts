import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { currentLang } from './app/core/i18n/translate';

// Screen readers and the browser's spell checker use it.
document.documentElement.lang = currentLang;

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
