/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createProgressAndSuccessNotificationMode } from '@salesforce/effect-ext-utils';

export type CommandKey = 'Retrieve Metadata';

export const { showSuccessNotification, getProgressLocation } = createProgressAndSuccessNotificationMode<CommandKey>(
  'salesforcedx-vscode-org-browser',
  'sf-org-browser-notifications',
  'Salesforce: Org Browser Notifications'
);
