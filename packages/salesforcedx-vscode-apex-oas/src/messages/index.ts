/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationService, MessageArgs } from '@salesforce/salesforcedx-utils-vscode';
import { messages as enMessages, MessageKey } from './i18n';

const INSTANCE_NAME = 'salesforcedx-vscode-apex-oas';

const localizationService = LocalizationService.getInstance(INSTANCE_NAME);

localizationService.messageBundleManager.registerMessageBundle(INSTANCE_NAME, {
  messages: enMessages,
  type: 'base'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    localizationService.localize(key, ...args)
};
