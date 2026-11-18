import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SnackbarHost } from './shared/snackbar/snackbar-host';

// The root component only hosts the router and the global snackbar.
// The visible frame (sidebar or auth card) comes from the layout components in app.routes.ts.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SnackbarHost],
  template: '<router-outlet /><app-snackbar-host />',
})
export class App {}
