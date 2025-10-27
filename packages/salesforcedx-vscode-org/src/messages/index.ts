/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationService, MessageArgs } from '@salesforce/salesforcedx-utils-vscode';
import { messages, MessageKey } from './i18n';

// Default instance name
const INSTANCE_NAME = 'salesforcedx-vscode-org';

// Register messages
const localizationService = LocalizationService.getInstance(INSTANCE_NAME);

localizationService.messageBundleManager.registerMessageBundle(INSTANCE_NAME, {
  messages,
  type: 'base'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof messages>): string =>
    localizationService.localize(key, ...args)
};
