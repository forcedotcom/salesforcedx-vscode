/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNls } from '@salesforce/vscode-i18n';
import { telemetryService } from '../telemetry';
import { messages as enMessages, isValidMessageKey, MessageKey } from './i18n';
import { messages as jaMessages } from './i18n.ja';

export const nls = createNls({ instanceName: 'salesforcedx-vscode-core', messages: enMessages, jaMessages });

export const coerceMessageKey = (key: string): MessageKey => {
  const isValid = isValidMessageKey(key);

  if (!isValid) {
    // Send telemetry exception for missing message key
    telemetryService.sendException('missing_message_key', `Invalid message key: ${key}`);
  }

  return isValid ? key : 'missing_label';
};
