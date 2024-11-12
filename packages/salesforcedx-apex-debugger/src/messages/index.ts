/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  BASE_FILE_EXTENSION,
  BASE_FILE_NAME,
  Config,
  DEFAULT_LOCALE,
  Localization,
  Message
} from '@salesforce/salesforcedx-utils';
import { messages } from './i18n';
import { messages as jaMessages } from './i18n.ja';

const loadMessageBundle = (config?: Config): Message => {
  const resolveFileName = (locale: string): string => {
    return locale === DEFAULT_LOCALE
      ? `${BASE_FILE_NAME}.${BASE_FILE_EXTENSION}`
      : `${BASE_FILE_NAME}.${locale}.${BASE_FILE_EXTENSION}`;
  };

  const base = new Message(messages);

  if (config && config.locale && config.locale !== DEFAULT_LOCALE) {
    if (config.locale === 'ja') {
      const layer = new Message(jaMessages, base);
      return layer;
    }

    console.error(`Cannot find ${config.locale}, defaulting to en`);
  }

  return base;
};

export const nls = new Localization(
  loadMessageBundle(process.env.VSCODE_NLS_CONFIG ? JSON.parse(process.env.VSCODE_NLS_CONFIG!) : undefined)
);
