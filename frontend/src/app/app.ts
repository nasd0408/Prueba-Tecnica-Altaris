import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfirmDialog } from './shared/confirm/confirm-dialog';
import { SnackbarHost } from './shared/snackbar/snackbar-host';

// The root component only hosts the router and the global overlays (snackbar, confirm dialog).
// The visible frame (sidebar or auth card) comes from the layout components in app.routes.ts.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SnackbarHost, ConfirmDialog],
  template: '<router-outlet /><app-snackbar-host /><app-confirm-dialog />',
})
export class App {}
