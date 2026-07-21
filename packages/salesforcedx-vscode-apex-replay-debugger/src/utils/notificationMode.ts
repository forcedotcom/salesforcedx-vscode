/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNotificationModeApi } from '@salesforce/effect-ext-utils';

type ProgressAndSuccessCommandKey = 'Debug Apex Test Class' | 'Debug Anonymous Apex';

type ProgressOnlyCommandKey = 'Update Checkpoints in Org';

export type CommandKey = ProgressAndSuccessCommandKey | ProgressOnlyCommandKey;

export const { showSuccessNotification, getProgressLocation } = createNotificationModeApi<
  ProgressAndSuccessCommandKey,
  never,
  ProgressOnlyCommandKey
>(
  'salesforcedx-vscode-apex-replay-debugger',
  'sf-apex-replay-debugger-notifications',
  'Salesforce: Apex Replay Debugger Notifications'
);
