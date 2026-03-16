/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LOCALE_JA, LocalizationService, type MessageArgs } from '@salesforce/vscode-i18n';
import { EXTENSION_NAME } from '../constants';
import { messages, type MessageKey } from './i18n';
import { messages as jaMessages } from './i18n.ja';

const localizationService = LocalizationService.getInstance(EXTENSION_NAME);

localizationService.messageBundleManager.registerMessageBundle(EXTENSION_NAME, {
  messages,
  type: 'base'
});

localizationService.messageBundleManager.registerMessageBundle(EXTENSION_NAME, {
  messages: { ...jaMessages, _locale: LOCALE_JA },
  type: 'locale',
  locale: LOCALE_JA
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof messages>): string =>
    localizationService.localize(key, ...args)
};
