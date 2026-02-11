/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationService, type MessageArgs } from '@salesforce/vscode-i18n';
import { SERVICES_CHANNEL_NAME } from '../constants';
import { messages, type MessageKey } from './i18n';

const localizationService = LocalizationService.getInstance(SERVICES_CHANNEL_NAME);

localizationService.messageBundleManager.registerMessageBundle(SERVICES_CHANNEL_NAME, {
  messages,
  type: 'base'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof messages>): string =>
    localizationService.localize(key, ...args)
};
