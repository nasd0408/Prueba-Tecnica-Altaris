import { Pipe, PipeTransform } from '@angular/core';

import { TranslateParams, translate } from './translate';

// {{ 'hotels.list.title' | t }}  or  {{ 'hotels.list.count' | t: { count: n } }}
// Pure pipe: the language never changes while the app is running (changing it reloads),
// so Angular can cache the result for the same key and params.
@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  transform(key: string, params?: TranslateParams): string {
    return translate(key, params);
  }
}
