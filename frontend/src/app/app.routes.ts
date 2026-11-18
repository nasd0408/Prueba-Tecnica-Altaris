import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { Shell } from './layout/shell/shell';

// Two layout routes with an empty path (public auth pages / private shell), each with its own
// guard, so individual pages never check authentication themselves.
// The root URL is redirected explicitly first: an empty-path layout route with children also
// matches "/" with no child at all, so without this "/" would render the auth frame empty.
// Pages are lazy-loaded: each one is its own JS chunk, so the first load stays small.
// Titles are i18n keys, translated by TranslatedTitleStrategy.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '',
    component: AuthLayout,
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
        title: 'titles.signIn',
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
        title: 'titles.register',
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
        title: 'titles.resetPassword',
      },
    ],
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'titles.dashboard',
      },
      {
        path: 'today',
        loadComponent: () => import('./features/daily/daily-operations').then((m) => m.DailyOperations),
        title: 'titles.today',
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/reservations/reservation-list/reservation-list').then((m) => m.ReservationList),
        title: 'titles.reservations',
      },
      {
        path: 'reservations/new',
        loadComponent: () =>
          import('./features/reservations/reservation-form/reservation-form').then((m) => m.ReservationForm),
        title: 'titles.newReservation',
      },
      {
        // After 'reservations/new' so "new" isn't taken as an id.
        path: 'reservations/:id',
        loadComponent: () =>
          import('./features/reservations/reservation-detail/reservation-detail').then((m) => m.ReservationDetail),
        title: 'titles.reservation',
      },
      {
        path: 'hotels',
        loadComponent: () => import('./features/hotels/hotel-list/hotel-list').then((m) => m.HotelList),
        title: 'titles.hotels',
      },
      {
        path: 'hotels/new',
        loadComponent: () => import('./features/hotels/hotel-form/hotel-form').then((m) => m.HotelForm),
        title: 'titles.newHotel',
      },
      {
        // Declared after 'hotels/new' so "new" isn't taken as an id.
        path: 'hotels/:id',
        loadComponent: () => import('./features/hotels/hotel-detail/hotel-detail').then((m) => m.HotelDetail),
        title: 'titles.hotel',
      },
      {
        path: 'hotels/:id/availability',
        loadComponent: () =>
          import('./features/hotels/hotel-availability/hotel-availability').then((m) => m.HotelAvailability),
        title: 'titles.availability',
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory-overview').then((m) => m.InventoryOverviewPage),
        title: 'titles.inventory',
      },
      {
        path: 'hotels/:id/edit',
        loadComponent: () => import('./features/hotels/hotel-form/hotel-form').then((m) => m.HotelForm),
        title: 'titles.editHotel',
      },
      {
        path: 'catalogues/room-types',
        loadComponent: () =>
          import('./features/catalogues/room-types/room-types-page').then((m) => m.RoomTypesPage),
        title: 'titles.roomTypes',
      },
      {
        path: 'catalogues/amenities',
        loadComponent: () =>
          import('./features/catalogues/amenities/amenities-page').then((m) => m.AmenitiesPage),
        title: 'titles.amenities',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
