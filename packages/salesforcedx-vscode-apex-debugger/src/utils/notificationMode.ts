/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNotificationModeApi } from '@salesforce/effect-ext-utils';

type ProgressAndSuccessCommandKey = 'SFDX: Stop Apex Debugger Session';

type ProgressOnlyCommandKey = 'SFDX: Create and Set Up Project for ISV Debugging';

export type CommandKey = ProgressAndSuccessCommandKey | ProgressOnlyCommandKey;

export const { getProgressLocation, showSuccessNotification, disposable } = createNotificationModeApi<
  ProgressAndSuccessCommandKey,
  never,
  ProgressOnlyCommandKey
>(
  'salesforcedx-vscode-apex-debugger',
  'sf-apex-debugger-notifications',
  'Salesforce: Apex Interactive Debugger Notifications'
);
