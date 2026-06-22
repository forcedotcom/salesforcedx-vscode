/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createProgressAndSuccessNotificationMode } from '@salesforce/effect-ext-utils';

export type CommandKey =
  | 'SFDX: Deploy This Source to Org'
  | 'SFDX: Retrieve This Source from Org'
  | 'SFDX: Push Source to Default Org'
  | 'SFDX: Pull Source from Default Org'
  | 'SFDX: Deploy Source in Manifest to Org'
  | 'SFDX: Retrieve Source in Manifest from Org'
  | 'SFDX: Delete from Project and Org'
  | 'SFDX: Diff Source Against Org'
  | 'Deploy on Save'
  | 'SFDX: Install Package';

export const { showSuccessNotification, getProgressLocation } = createProgressAndSuccessNotificationMode<CommandKey>(
  'salesforcedx-vscode-metadata',
  'sf-metadata-notifications',
  'Salesforce: Metadata Notifications'
);
