import { formatDate } from '@angular/common';
import { isAxiosError } from 'axios';

import { currentLocale, hasTranslation, translate } from '../i18n/translate';

// Shape of a business error from the API (ProblemDetails extensions, see backend Errors/ApiError.cs).
export interface ApiErrorInfo {
  code: string;
  message?: string;
  args?: Record<string, unknown>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turns any error from an API call into one sentence in the user's language.
 * 1. No response -> network message.  2. 429 -> rate limit message.
 * 3. A "code" from the API -> its translation, with the args formatted for the current locale.
 * 4. Unknown code -> the English "detail" from the API (better than nothing).  5. Otherwise the fallback key.
 */
export function describeApiError(error: unknown, fallbackKey: string): string {
  if (!isAxiosError(error)) return translate(fallbackKey);
  if (!error.response) return translate('errors.network');

  const { status, data } = error.response;
  if (status === 429) return translate('errors.tooManyRequests');

  if (typeof data?.code === 'string') {
    return translateApiError({ code: data.code, message: data.detail, args: data.args }) ?? translate(fallbackKey);
  }

  return typeof data?.detail === 'string' ? data.detail : translate(fallbackKey);
}

/** Same translation for errors that arrive inside a normal response (e.g. the quote's "problem"). */
export function translateApiError(error: ApiErrorInfo): string | null {
  const args = error.args ?? {};

  // Identity sends a list of its own codes; each one has its sentence.
  if (error.code === 'identity.failed' && Array.isArray(args['codes'])) {
    return (args['codes'] as string[])
      .map((c) => (hasTranslation(`errors.identity.${c}`) ? translate(`errors.identity.${c}`) : c))
      .join(' ');
  }

  // A list of example nights becomes "Double 20/11 (9 booked), Twin 21/11 (3 booked)".
  if (error.code === 'availability.belowBooked' && Array.isArray(args['examples'])) {
    const examples = (args['examples'] as Record<string, unknown>[])
      .map((e) => translate('errors.availability.bookedExample', formatArgs(e)))
      .join(', ');
    return translate('errors.availability.belowBooked', { ...formatArgs(args), examples });
  }

  if (error.code === 'validation.failed' && Array.isArray(args['fields'])) {
    return translate('errors.validation.failed', { fields: (args['fields'] as string[]).join(', ') });
  }

  const key = `errors.${error.code}`;
  if (hasTranslation(key)) return translate(key, formatArgs(args));
  return error.message ?? null;
}

// Values come raw from the API: ISO dates are shown as dates in the user's locale and reservation
// statuses with their translated label. Everything else goes as is.
function formatArgs(args: Record<string, unknown>): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(args)) {
    if (typeof value === 'string' && ISO_DATE.test(value)) {
      result[name] = formatDate(value, 'dd/MM/yyyy', currentLocale);
    } else if ((name === 'status' || name === 'target') && typeof value === 'string') {
      result[name] = translate(`status.${value}`).toLowerCase();
    } else if (typeof value === 'string' || typeof value === 'number') {
      result[name] = value;
    }
  }
  return result;
}
