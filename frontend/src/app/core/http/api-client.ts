import axios from 'axios';

// Single axios instance for the whole app. Everything that talks to the API goes through it,
// so the auth header and the 401/refresh handling are configured in exactly one place
// (the interceptors are registered by AuthService, which owns the tokens).
//
// baseURL is relative: in dev the Angular proxy forwards /api to the API, in Docker nginx does it.
// Same build works everywhere, no environment files needed.
export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});
