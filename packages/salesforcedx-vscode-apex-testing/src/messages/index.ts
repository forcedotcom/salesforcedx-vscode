/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalizationService, type MessageArgs } from '@salesforce/vscode-i18n';
import { messages as enMessages, MessageKey } from './i18n';

// Default instance name for backward compatibility
const DEFAULT_INSTANCE = 'salesforcedx-vscode-apex-testing';

// Register default Apex Testing extension messages
const localizationService = LocalizationService.getInstance(DEFAULT_INSTANCE);

localizationService.messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
  messages: enMessages,
  type: 'base'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    localizationService.localize(key, ...args)
};
