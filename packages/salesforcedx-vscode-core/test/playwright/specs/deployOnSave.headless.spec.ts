/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  verifyCommandExists,
  executeCommandWithCommandPalette,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  validateNoCriticalErrors,
  saveScreenshot,
  DIRTY_EDITOR,
  ensureSecondarySideBarHidden
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { COMMAND_TIMEOUT, OUTPUT_CHANNEL } from '../constants';
import { createApexClassCore } from '../coreHelpers';

test('Deploy On Save: automatically deploys when file is saved', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `DeployOnSaveTest${Date.now()}`;

  await test.step('setup: workbench, settings, enable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    // Ensure core commands are active (not metadata extension commands)
    await upsertSettings(page, { 'salesforcedx-vscode-core.useMetadataExtensionCommands': 'false' });

    // Enable deploy-on-save before creating class (set separately to avoid search box concatenation)
    await upsertSettings(page, { 'salesforcedx-vscode-core.push-or-deploy-on-save.enabled': 'true' });
    await upsertSettings(page, { 'salesforcedx-vscode-core.push-or-deploy-on-save.preferDeployOnSave': 'true' });

    // Open output panel and select Salesforce CLI channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, OUTPUT_CHANNEL, 120_000);
    await saveScreenshot(page, 'setup.output-channel-ready.png');

    // Wait for extension to fully activate (context keys like sf:has_target_org)
    // Use a command that doesn't require a file to be open
    await verifyCommandExists(page, 'SFDX: View Local Changes', 120_000);
  });

  await test.step('create apex class and verify deploy-on-save triggers', async () => {
    await clearOutputChannel(page);

    // Create the apex class
    await createApexClassCore(page, className);
    await saveScreenshot(page, 'setup.class-created.png');

    // Save the file - this will trigger deploy-on-save (DeployQueue has 500ms delay + deploy time)
    await executeCommandWithCommandPalette(page, 'File: Save');
    await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });

    // Wait for deploy-on-save to complete
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Deploy This Source to Org',
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'deploy-on-save.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
