/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  openFileByName,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  EDITOR,
  QUICK_INPUT_WIDGET,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';

// eslint-disable-next-line jest/unbound-method
(isMacDesktop() ? test.skip : test)('Retrieve In Manifest: retrieves via all entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');
  });

  await test.step('create apex class', async () => {
    // Create apex class (opens editor automatically)
    className = `RetrieveManifestTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'setup.after-create-class.png');
  });

  await test.step('generate manifest from apex class', async () => {
    // Generate manifest from the active editor (Apex class)
    await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

    // Wait for input prompt
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'visible', timeout: 10_000 });

    // Accept default filename (package.xml) by pressing Enter
    await page.keyboard.press('Enter');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
  });

  await test.step('deploy class to org', async () => {
    // Open the manifest file
    await openFileByName(page, 'package.xml');

    // Ensure the manifest editor is focused and ready
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click();

    // Deploy the manifest to push the class to the org
    await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, 'manifest/package.xml');

    // Verify deploy completes
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

    // Check for deploy error notifications
    const postDeployNotifications = page.locator(NOTIFICATION_LIST_ITEM);
    const deployErrorPattern = new RegExp(
      `${messages.deploy_completed_with_errors_message}|${messages.deploy_failed.replaceAll('%s', '.*')}`,
      'i'
    );
    const deployErrorNotification = postDeployNotifications.filter({ hasText: deployErrorPattern }).first();
    const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasDeployError) {
      const errorText = await deployErrorNotification.textContent();
      throw new Error(`Deploy failed with error notification: ${errorText}`);
    }
  });

  await test.step('1. Editor context menu', async () => {
    // Open the manifest file (Quick Open shows just "package.xml")
    await openFileByName(page, 'package.xml');

    // Ensure the manifest editor is focused and ready
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click();

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    // Right-click the manifest editor → "SFDX: Retrieve Source in Manifest from Org"
    await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, 'manifest/package.xml');

    // Verify retrieve starts and completes via output channel
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: 240_000 });
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');

    // Prepare output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    // Right-click manifest in explorer → "SFDX: Retrieve Source in Manifest from Org"
    await executeExplorerContextMenuCommand(page, /package\.xml/i, packageNls.retrieve_in_manifest_text);

    // Verify retrieve starts and completes via output channel
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: 240_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
