/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNotificationModeApi } from '@salesforce/effect-ext-utils';

export type ProgressAndSuccessCommandKey =
  | 'SFDX: Execute Anonymous Apex with Currently Open Editor'
  | "SFDX: Execute Anonymous Apex with Editor's Selected Text";

export type SuccessOnlyCommandKey =
  | 'SFDX: Remove Trace Flag for Current User'
  | 'SFDX: Remove Trace Flag'
  | 'SFDX: Remove Debug Level';

export const { showSuccessNotification, getProgressLocation, showSuccessOnlyNotification } = createNotificationModeApi<
  ProgressAndSuccessCommandKey,
  SuccessOnlyCommandKey
>('salesforcedx-vscode-apex-log', 'sf-apex-log-notifications', 'Salesforce: Apex Log Notifications');
