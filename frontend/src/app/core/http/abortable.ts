import { Observable } from 'rxjs';

/**
 * Wraps a promise-based (axios) call in an Observable that aborts the HTTP request on unsubscribe.
 *
 * Why: axios returns promises, but for search-as-you-type I still want RxJS operators
 * (debounce, switchMap). A plain `from(promise)` would ignore the cancellation: switchMap would drop
 * the old result but the request would keep running. With AbortController the browser really
 * cancels it, which is what Angular's HttpClient does out of the box.
 */
export function fromAbortable<T>(request: (signal: AbortSignal) => Promise<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    const controller = new AbortController();

    request(controller.signal)
      .then((value) => {
        subscriber.next(value);
        subscriber.complete();
      })
      .catch((error) => {
        // An aborted request is expected (newer search started), not an error to report.
        if (!controller.signal.aborted) subscriber.error(error);
      });

    return () => controller.abort();
  });
}
