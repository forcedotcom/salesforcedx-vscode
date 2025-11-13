/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationService } from '@salesforce/vscode-i18n';
import { EXTENSION_NAME } from '../constants';
import { messages } from './i18n';

const localizationService = LocalizationService.getInstance(EXTENSION_NAME);

localizationService.messageBundleManager.registerMessageBundle(EXTENSION_NAME, {
  messages,
  type: 'base'
});

export const nls = {
  localize: (key: keyof typeof messages, ...args: unknown[]): string => localizationService.localize(key, ...args)
};
