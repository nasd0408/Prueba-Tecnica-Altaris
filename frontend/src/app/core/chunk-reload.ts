import { NavigationError } from '@angular/router';

const LAST_RELOAD_KEY = 'altairis.chunkReloadAt';
const MIN_SECONDS_BETWEEN_RELOADS = 10;

// Messages browsers use when a lazy-loaded page file can't be fetched or isn't valid JS.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|ChunkLoadError|Unexpected token '<'/i;

/**
 * Pages are lazy-loaded files with a hash in the name (chunk-XXXX.js). If a new version is
 * deployed while someone has the app open, their old app asks for chunk names that no longer
 * exist and the navigation fails, leaving an empty page.
 * The fix is a full reload to the same URL: the browser gets the new index.html and its files.
 * A time guard prevents a reload loop if the error has a different cause.
 */
export function reloadOnChunkError(navigation: NavigationError): void {
  const message = String((navigation.error as Error)?.message ?? navigation.error);
  if (!CHUNK_ERROR.test(message)) return;

  const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0);
  if (Date.now() - last < MIN_SECONDS_BETWEEN_RELOADS * 1000) {
    console.error('[app] A page could not be loaded even after reloading.', navigation.error);
    return;
  }

  sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
  location.assign(navigation.url);
}
