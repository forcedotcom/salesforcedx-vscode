/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNotificationMode } from '@salesforce/effect-ext-utils';

export type CommandKey = 'SOQL Query Execution' | 'Save Query Results';

export const { showSuccessNotification, getProgressLocation } = createNotificationMode<CommandKey>(
  'salesforcedx-vscode-soql',
  'sf-soql-notifications',
  'Salesforce: SOQL Notifications'
);
