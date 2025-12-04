/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationService, type MessageArgs } from '@salesforce/vscode-i18n';
import { EXTENSION_NAME } from '../constants';
import { messages as enMessages, type MessageKey } from './i18n';

const localizationService = LocalizationService.getInstance(EXTENSION_NAME);

localizationService.messageBundleManager.registerMessageBundle(EXTENSION_NAME, {
  messages: enMessages,
  type: 'base'
});

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    localizationService.localize(key, ...args)
};
