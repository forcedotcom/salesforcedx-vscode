/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNls } from '@salesforce/vscode-i18n';
import { messages as enMessages, isValidMessageKey, type MessageKey } from './i18n';

export const nls = createNls({ instanceName: 'salesforcedx-vscode-org-browser', messages: enMessages });

export const coerceMessageKey = (key: string): MessageKey => {
  const isValid = isValidMessageKey(key);
  return isValid ? key : 'retrieve_canceled';
};
