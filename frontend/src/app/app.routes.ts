import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { Shell } from './layout/shell/shell';

// Two layout routes with an empty path: the router tries the public (auth) group first and,
// if no child matches, falls through to the private group. Each group has its own guard,
// so individual pages never check authentication themselves.
// Pages are lazy-loaded: each one is its own JS chunk, so the first load stays small.
export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
        title: 'Sign in - Altairis',
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
        title: 'Create account - Altairis',
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
        title: 'Reset password - Altairis',
      },
    ],
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - Altairis',
      },
      {
        path: 'hotels',
        loadComponent: () => import('./features/hotels/hotel-list/hotel-list').then((m) => m.HotelList),
        title: 'Hotels - Altairis',
      },
      {
        path: 'hotels/new',
        loadComponent: () => import('./features/hotels/hotel-form/hotel-form').then((m) => m.HotelForm),
        title: 'New hotel - Altairis',
      },
      {
        path: 'hotels/:id/edit',
        loadComponent: () => import('./features/hotels/hotel-form/hotel-form').then((m) => m.HotelForm),
        title: 'Edit hotel - Altairis',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
