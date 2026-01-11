/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { expect } from '@playwright/test';
import packageNls from '../../../package.nls.json';

test('Retrieve Current Source File: retrieves active file via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create and deploy apex class', async () => {
    // Create apex class locally (this also opens the file)
    className = `RetrieveCurrentFileTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // Edit the class to create local change (file is already open from createApexClass)
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, 'Initial version to deploy');
    await saveScreenshot(page, 'step1.after-edit.png');

    // Wait for local count to increment
    await statusBarPage.waitForCounts({ local: 1 }, 60_000);
    await saveScreenshot(page, 'step1.after-local-count-1.png');

    // Deploy the file via command palette
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await saveScreenshot(page, 'step1.after-deploy-command.png');

    // Verify deploy completes
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
    await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
    await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    await saveScreenshot(page, 'step1.deploy-complete.png');
  });

  await test.step('make local change and retrieve to restore deployed version', async () => {
    // Close all editors to ensure clean state
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');
    await saveScreenshot(page, 'step2.after-close-editors.png');

    // Ensure status bar is ready and file is synced (local=0) after step 1 deploy
    await statusBarPage.waitForVisible(10_000);
    await statusBarPage.waitForCounts({ local: 0 }, 30_000);
    await saveScreenshot(page, 'step2.after-sync-confirmed.png');

    // Wait a moment for VS Code to fully process editor closure
    await page.waitForTimeout(1000);

    // Make another local edit to create a difference between local and org
    await openFileByName(page, `${className}.cls`);
    await saveScreenshot(page, 'step2.after-open-file.png');
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, 'Local change to be overwritten by retrieve');
    await saveScreenshot(page, 'step2.after-local-edit.png');

    // Wait for local count to increment
    await statusBarPage.waitForCounts({ local: 1 }, 60_000);
    await saveScreenshot(page, 'step2.after-local-count-1.png');

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    // Execute retrieve via command palette with the file still open
    await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);
    await saveScreenshot(page, 'step2.after-retrieve-command.png');

    // Verify retrieve starts and completes via output channel
    // Retrieve operations may not show progress notifications consistently across platforms
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await saveScreenshot(page, 'step2.retrieve-started.png');

    await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: 240_000 });
    await saveScreenshot(page, 'step2.retrieve-complete.png');

    // After retrieve, local count should go back to 0 (file retrieved from org)
    await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    await saveScreenshot(page, 'step2.final-state.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
