import { isAxiosError } from 'axios';

// Turns any API error into one readable line for the UI.
// ASP.NET returns ProblemDetails: validation errors in `errors: { Field: ["msg"] }`,
// other errors with a human message in `detail`.
export function describeApiError(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;

  if (!error.response) return 'Cannot reach the server. Check your connection and try again.';

  const { status, data } = error.response;

  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';

  const errors = data?.errors as Record<string, string[]> | undefined;
  if (status === 400 && errors) return Object.values(errors).flat().join(' ');

  if (typeof data?.detail === 'string') return data.detail;

  return fallback;
}
