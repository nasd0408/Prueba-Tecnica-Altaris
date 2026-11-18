import { en } from './en';
import { es } from './es';

export type Lang = 'en' | 'es';
export type Dictionary = typeof en;
export type TranslateParams = Record<string, string | number | null | undefined>;

const STORAGE_KEY = 'altairis.lang';
const dictionaries: Record<Lang, Dictionary> = { en, es };

// The language is decided once, when the app loads: the saved choice, otherwise the browser's.
// Changing it reloads the page (see setLanguage). Why not switch live: Angular's LOCALE_ID, which
// formats every date, number and currency, can only be set at bootstrap. Changing language is a
// rare action, so a reload is a fair price for keeping everything consistent and simple.
export const currentLang: Lang = detectLanguage();

// Locale used by Angular's pipes and formatDate/formatNumber. en-GB rather than en-US: day/month
// order and EUR are what a European operations team expects.
export const currentLocale = currentLang === 'es' ? 'es-ES' : 'en-GB';

function detectLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // storage blocked: fall back to the browser language
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function setLanguage(lang: Lang): void {
  if (lang === currentLang) return;
  localStorage.setItem(STORAGE_KEY, lang);
  location.reload();
}

/**
 * Looks up a dotted key ("hotels.list.title") in the current dictionary and fills {placeholders}.
 * Plurals: if the entry is { one, other } and params.count is given, picks the right form.
 * Missing in Spanish -> English; missing everywhere -> the key itself (visible, easy to spot).
 */
export function translate(key: string, params?: TranslateParams): string {
  const value = lookup(dictionaries[currentLang], key) ?? lookup(en, key);
  if (value === undefined) {
    console.warn(`[i18n] Missing key: ${key}`);
    return key;
  }

  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else {
    const forms = value as { one?: string; other?: string };
    text = (params?.['count'] === 1 ? forms.one : forms.other) ?? forms.other ?? key;
  }

  return params ? text.replace(/\{(\w+)\}/g, (match, name) => formatParam(name, params[name]) ?? match) : text;
}

// Numbers inside messages use the language's separators ("10,000" / "10.000"),
// except identifiers, which are shown as they are.
const numberFormat = new Intl.NumberFormat(currentLocale);
function formatParam(name: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !/id$/i.test(name)) return numberFormat.format(value);
  return value.toString();
}

export function hasTranslation(key: string): boolean {
  return lookup(dictionaries[currentLang], key) !== undefined || lookup(en, key) !== undefined;
}

function lookup(dictionary: unknown, key: string): unknown {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (node !== null && typeof node === 'object' && 'other' in node) ? node : undefined;
}
