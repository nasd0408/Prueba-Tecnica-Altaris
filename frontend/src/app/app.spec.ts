import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';

describe('App routing', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  // Regression: "/" used to render the auth layout with no page inside when signed out.
  it('sends the root URL to the login page when there is no session', async () => {
    TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    expect(router.url).toBe('/login?returnUrl=%2Fdashboard');
  });

  it('redirects to the login page when there is no session', async () => {
    TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/hotels');
    expect(router.url).toBe('/login?returnUrl=%2Fhotels');
  });
});
