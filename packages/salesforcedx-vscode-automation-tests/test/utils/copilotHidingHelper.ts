/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Duration, log, pause } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  clickButtonOnModalDialog,
  executeQuickPick
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';

export const tryToHideCopilot = async (): Promise<void> => {
  try {
    await executeQuickPick('Chat: Hide AI Features');
    await pause(Duration.seconds(1));
    await clickButtonOnModalDialog('Hide AI Features');
  } catch {
    try {
      await executeQuickPick('Chat: Hide Copilot');
      await pause(Duration.seconds(1));
      await clickButtonOnModalDialog('Hide Copilot');
    } catch {
      log('Chat: Hide Copilot not found');
    }
  }
};
