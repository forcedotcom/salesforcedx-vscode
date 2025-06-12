/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LOCALE_JA, MessageArgs, LocalizationService } from '@salesforce/salesforcedx-utils-vscode';
import { messages as enMessages, MessageKey } from './i18n';
import { messages as jaMessages } from './i18n.ja';

// Default instance name for backward compatibility
const DEFAULT_INSTANCE = 'salesforcedx-vscode-apex';

// Register default Apex extension messages
const localizationService = LocalizationService.getInstance(DEFAULT_INSTANCE);

localizationService.messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
  messages: enMessages,
  type: 'base'
});
localizationService.messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
  messages: { ...jaMessages, _locale: LOCALE_JA },
  type: 'locale'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    localizationService.localize(key, ...args)
};
