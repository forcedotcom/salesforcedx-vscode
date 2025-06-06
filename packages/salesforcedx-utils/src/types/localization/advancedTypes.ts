/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { format } from 'node:util';
import { Locale } from './config';

export type AdvancedMessageBundle = {
  messages: Record<string, string>;
  type: 'base' | 'locale';
  locale?: Locale;
};

export type MessageArgs<T extends string, M extends Record<string, string>> = {
  [K in T]: M[K] extends string ? Parameters<typeof format>[1][] : never;
};
