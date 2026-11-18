import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

// Functional guards (the current Angular style): a function instead of a class implementing CanActivate.
// Note they only improve UX; the real protection is the API rejecting requests without a valid token.

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;

  // Returning a UrlTree (instead of calling navigate) lets the router cancel and redirect in one step.
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

// Keeps a signed-in user away from login/register.
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
