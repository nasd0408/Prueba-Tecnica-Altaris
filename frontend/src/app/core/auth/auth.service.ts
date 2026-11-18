import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { api } from '../http/api-client';

// Response of POST /api/auth/login and /api/auth/refresh (format written by Identity's bearer handler).
interface TokenResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number; // seconds
  refreshToken: string;
}

interface Session {
  userName: string;
  accessToken: string;
  refreshToken: string;
}

type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean };

const STORAGE_KEY = 'altairis.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  // Session kept in a signal so the UI (topbar, guards) reacts to login/logout automatically.
  private readonly session = signal<Session | null>(readStoredSession());

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly userName = computed(() => this.session()?.userName ?? '');

  // Several requests can get a 401 at the same time when the token expires.
  // They all wait for the same refresh call instead of each one firing its own.
  private refreshInFlight: Promise<string | null> | null = null;

  constructor() {
    // The service is created by the route guards before any page makes a request,
    // so the interceptors are always in place before the first API call.
    this.registerInterceptors();
  }

  async login(userName: string, password: string): Promise<void> {
    const { data } = await api.post<TokenResponse>('/auth/login', { userName, password });
    this.saveSession({ userName, accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  async register(userName: string, email: string | null, password: string): Promise<void> {
    await api.post('/auth/register', { userName, email, password });
  }

  // MVP: no verification step (no email code / MFA yet), see AuthController.ResetPassword.
  async resetPassword(userName: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { userName, newPassword });
  }

  logout(sessionExpired = false): void {
    this.saveSession(null);
    // On expiry, remember where the user was so they land back there after signing in again.
    const queryParams = sessionExpired ? { returnUrl: this.router.url, expired: 1 } : {};
    this.router.navigate(['/login'], { queryParams });
  }

  private registerInterceptors(): void {
    api.interceptors.request.use((config) => {
      const token = this.session()?.accessToken;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Access tokens are short-lived (1h). On a 401, try once to get a new one with the refresh
    // token and repeat the original request; the user doesn't notice. If that fails, sign out.
    api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const request = error.config as RetriableRequest | undefined;
        const isAuthCall = request?.url?.startsWith('/auth/');

        if (error.response?.status !== 401 || !request || request._retried || isAuthCall) {
          throw error;
        }

        request._retried = true; // avoid an infinite loop if the new token is rejected too
        const newToken = await this.refreshAccessToken();
        if (!newToken) {
          this.logout(true);
          throw error;
        }

        request.headers.Authorization = `Bearer ${newToken}`;
        return api(request);
      },
    );
  }

  private refreshAccessToken(): Promise<string | null> {
    const current = this.session();
    if (!current) return Promise.resolve(null);

    this.refreshInFlight ??= api
      .post<TokenResponse>('/auth/refresh', { refreshToken: current.refreshToken })
      .then(({ data }) => {
        this.saveSession({ ...current, accessToken: data.accessToken, refreshToken: data.refreshToken });
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => (this.refreshInFlight = null));

    return this.refreshInFlight;
  }

  // localStorage keeps the session across reloads and tabs. Trade-off: it's readable by JS,
  // so an XSS bug could steal the token. The alternative is Identity's cookie mode
  // (HttpOnly cookie, ?useCookies=true), which needs CSRF protection instead.
  // For a backoffice on the same origin both are valid; bearer was the requirement here.
  private saveSession(session: Session | null): void {
    this.session.set(session);
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }
}

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null; // corrupted value: behave as signed out
  }
}
