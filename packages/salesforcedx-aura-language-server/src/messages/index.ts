/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Import message bundles
import { LocalizationService, MessageArgs } from '@salesforce/salesforcedx-utils';
import { messages as enMessages, MessageKey } from './i18n';

// Create a default instance of the localization service
const DEFAULT_INSTANCE = 'salesforcedx-aura-language-server';
const service = LocalizationService.getInstance(DEFAULT_INSTANCE);

// Register message bundles
const messageBundleManager = service.messageBundleManager;

// Register base messages
messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
  messages: enMessages,
  type: 'base'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    service.localize(key, ...args)
};
