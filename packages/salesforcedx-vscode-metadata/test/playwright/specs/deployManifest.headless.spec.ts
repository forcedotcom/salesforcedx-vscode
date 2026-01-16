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
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  isMacDesktop,
  validateNoCriticalErrors,
  captureOutputChannelDetails,
  NOTIFICATION_LIST_ITEM,
  EDITOR,
  QUICK_INPUT_WIDGET
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED, OUTPUT_CHANNEL_NAME } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';

/** Escape regex special characters in a string for use in RegExp */
// eslint-disable-next-line unicorn/prefer-string-replace-all -- regex escaping requires replace with regex pattern
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(isMacDesktop() ? test.skip.bind(test) : test)('Deploy Manifest: deploys via all entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and disable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);

    // Disable deploy-on-save so test can control when deploys happen
    await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
  });

  let initialLocalCount: number;

  await test.step('capture initial counts and create apex class', async () => {
    // Get initial counts
    const initialCounts = await statusBarPage.getCounts();
    initialLocalCount = initialCounts.local;

    // Create apex class (so manifest has something to deploy)
    className = `DeployManifestTest${Date.now()}`;
    await createApexClass(page, className);

    // Verify local count incremented by 1
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
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

  await test.step('1. Editor context menu', async () => {
    // Edit apex class to create local change
    await openFileByName(page, `${className}.cls`);

    await editOpenFile(page, 'Editor context menu manifest test');
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);

    // Open the manifest file (Quick Open shows just "package.xml")
    await openFileByName(page, 'package.xml');

    // Ensure the manifest editor is focused and ready
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click(); // Click to ensure focus

    // Right-click the manifest editor
    await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, 'manifest/package.xml');

    // Check for deploy-related error notifications before waiting for deploying notification
    // Match deploy_failed message or file system errors (ENOENT, manifest issues)
    const allNotifications = page.locator(NOTIFICATION_LIST_ITEM);
    const escapedDeployFailedEarly = escapeRegex(messages.deploy_failed.replaceAll('%s', '.*'));
    const earlyDeployErrorPattern = new RegExp(`${escapedDeployFailedEarly}|ENOENT.*package\\.xml|manifest`, 'i');
    const deployErrorNotification = allNotifications.filter({ hasText: earlyDeployErrorPattern }).first();
    const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasDeployError) {
      const errorText = await deployErrorNotification.textContent();
      throw new Error(`Deploy failed with error notification: ${errorText}`);
    }

    // Verify deploy completes - look for deploying notification
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

    // Check for deploy error notifications after deploy completes
    const postDeployNotifications = page.locator(NOTIFICATION_LIST_ITEM);
    // Match error messages from deployComponentSet (deploy_completed_with_errors_message) or deployManifest (deploy_failed)
    const escapedCompletedWithErrors = escapeRegex(messages.deploy_completed_with_errors_message);
    const escapedDeployFailed = escapeRegex(messages.deploy_failed.replaceAll('%s', '.*'));
    const deployErrorPattern = new RegExp(`${escapedCompletedWithErrors}|${escapedDeployFailed}`, 'i');
    const postDeployErrorNotification = postDeployNotifications.filter({ hasText: deployErrorPattern }).first();
    const hasPostDeployError = await postDeployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasPostDeployError) {
      const errorText = await postDeployErrorNotification.textContent();
      // Capture output channel details for debugging
      await captureOutputChannelDetails(page, OUTPUT_CHANNEL_NAME, 'deploy-error-metadata-output.png');
      throw new Error(`Deploy failed with error notification: ${errorText}`);
    }

    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');

    // Edit apex class again to create new local change
    await openFileByName(page, `${className}.cls`);
    // Ensure the editor is focused before editing
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, 'Explorer context menu manifest test');
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);

    // Right-click manifest in explorer → "SFDX: Deploy Source in Manifest to Org"
    await executeExplorerContextMenuCommand(page, /package\.xml/i, packageNls.deploy_in_manifest_text);

    // Verify deploy completes
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

    // Check for deploy error notifications after deploy completes
    const postDeployNotifications = page.locator(NOTIFICATION_LIST_ITEM);
    // Match error messages from deployComponentSet (deploy_completed_with_errors_message) or deployManifest (deploy_failed)
    const escapedCompletedWithErrors = escapeRegex(messages.deploy_completed_with_errors_message);
    const escapedDeployFailed = escapeRegex(messages.deploy_failed.replaceAll('%s', '.*'));
    const deployErrorPattern = new RegExp(`${escapedCompletedWithErrors}|${escapedDeployFailed}`, 'i');
    const postDeployErrorNotification = postDeployNotifications.filter({ hasText: deployErrorPattern }).first();
    const hasPostDeployError = await postDeployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasPostDeployError) {
      const errorText = await postDeployErrorNotification.textContent();
      // Capture output channel details for debugging
      await captureOutputChannelDetails(page, OUTPUT_CHANNEL_NAME, 'deploy-error-metadata-output-step2.png');
      throw new Error(`Deploy failed with error notification: ${errorText}`);
    }

    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
