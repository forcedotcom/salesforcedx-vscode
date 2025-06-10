/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Import message bundles
import { LOCALE_JA, LocalizationService, MessageArgs } from '@salesforce/salesforcedx-utils';
import { messages as enMessages, MessageKey } from './i18n';
import { messages as jaMessages } from './i18n.ja';

// Create a default instance of the localization service
const DEFAULT_INSTANCE = 'salesforcedx-vscode-lwc';
const service = LocalizationService.getInstance(DEFAULT_INSTANCE);

// Register message bundles
const messageBundleManager = service.messageBundleManager;

// Register base messages
messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
  messages: enMessages,
  type: 'base'
});

// Register locale-specific messages
messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
  messages: jaMessages,
  type: 'locale',
  locale: LOCALE_JA
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    service.localize(key, ...args)
};
