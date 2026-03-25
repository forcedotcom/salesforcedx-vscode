/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  createApexClass,
  executeCommandWithCommandPalette,
  clearOutputChannel,
  waitForOutputChannelText,
  validateNoCriticalErrors,
  saveScreenshot,
  DIRTY_EDITOR,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { COMMAND_TIMEOUT } from '../constants';
import { setupWorkbenchSettingsAndOutputChannel } from '../setupHelpers';
import packageNls from '../../../package.nls.json';

test('Deploy On Save: automatically deploys when file is saved', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `DeployOnSaveTest${Date.now()}`;

  await test.step('setup: workbench, settings, enable deploy-on-save', async () => {
    await setupWorkbenchSettingsAndOutputChannel(page, {
      extraSettings: {
        'salesforcedx-vscode-core.push-or-deploy-on-save.enabled': 'true',
        'salesforcedx-vscode-core.push-or-deploy-on-save.preferDeployOnSave': 'true'
      }
    });
    // Wait for extension to fully activate (context keys like sf:has_target_org). Use a command that doesn't require a file to be open.
    await verifyCommandExists(page, packageNls.view_local_changes_text, 120_000);
  });

  await test.step('create apex class and verify deploy-on-save triggers', async () => {
    await clearOutputChannel(page);

    // Create the apex class
    await createApexClass(page, className);
    await saveScreenshot(page, 'setup.class-created.png');

    // Save the file - this will trigger deploy-on-save (DeployQueue has 500ms delay + deploy time)
    await executeCommandWithCommandPalette(page, 'File: Save');
    await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });

    // Wait for deploy-on-save to complete
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'deploy-on-save.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
