/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LOCALE_JA } from '../constants';
import { messages as enMessages } from './i18n';
import { messages as jaMessages } from './i18n.ja';
import { Config, DEFAULT_LOCALE, Localization, Message } from './localization';

const supportedLocales = [DEFAULT_LOCALE, LOCALE_JA];

function loadMessageBundle(config?: Config): Message {
  const base = new Message(enMessages);

  const localeConfig = config ? config.locale : DEFAULT_LOCALE;

  if (localeConfig === LOCALE_JA) {
    return new Message(jaMessages, base);
  }

  if (supportedLocales.indexOf(localeConfig) === -1) {
    console.error(`Cannot find ${localeConfig}, defaulting to en`);
  }

  return base;
}

export const nls = new Localization(
  loadMessageBundle(
    process.env.VSCODE_NLS_CONFIG
      ? JSON.parse(process.env.VSCODE_NLS_CONFIG!)
      : undefined
  )
);
