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
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  openFileByName,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  verifyCommandDoesNotExist,
  isDesktop,
  QUICK_INPUT_WIDGET,
  EDITOR,
  NOTIFICATION_LIST_ITEM,
  HUB_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { RETRIEVE_TIMEOUT } from '../../constants';

// we skip this on the web, locally, because your hub might not be aliased as 'hub'.
// It works without tracking, but there's no way to set that in the webfs auth files, even if it's set correctly locally
// in CI, we use the devhub on the web
(isDesktop() || process.env.CI ? test : test.skip.bind(test))(
  'Non-Tracking Org: tracking UI elements are hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup non-tracking org', async () => {
      const createResult = await createNonTrackingOrg(isDesktop() ? NON_TRACKING_ORG_ALIAS : HUB_ORG_ALIAS);
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });

      // Wait for connection to be established and org info to be populated
      // The status bar will only appear if tracksSource is true, so we wait for it to NOT appear
      // This ensures the org info has been refreshed and the context is set correctly
      const statusBarPage = new SourceTrackingStatusBarPage(page);

      // Wait up to 30 seconds for the connection to establish
      // If the status bar appears, it means tracking is enabled (test will fail)
      // If it doesn't appear, we know the org is correctly detected as non-tracking
      await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: 30_000 });
    });

    await test.step('verify status bar widget does not appear', async () => {
      const statusBarPage = new SourceTrackingStatusBarPage(page);
      // The status bar should not appear for non-tracking orgs
      // We already verified this in setup, but check again to be sure
      await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: 5000 });
    });

    await test.step('verify reset tracking command does not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.reset_remote_tracking_text);
    });

    await test.step('verify view changes commands do not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.view_all_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_local_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_remote_changes_text);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);

(!isDesktop() ? test.skip.bind(test) : test)(
  'Non-Tracking Org: deploy/retrieve operations work without tracking',
  async ({ page }) => {
    test.setTimeout(RETRIEVE_TIMEOUT);

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;

    await test.step('setup non-tracking org', async () => {
      const createResult = await createNonTrackingOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    });

    await test.step('create apex class', async () => {
      className = `NonTrackingTest${Date.now()}`;
      await createApexClass(page, className);
    });

    await test.step('deploy class to org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

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

      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 30_000 });
    });

    await test.step('retrieve class from org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);

      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: RETRIEVE_TIMEOUT });
    });

    await test.step('generate manifest from apex class', async () => {
      await openFileByName(page, `${className}.cls`);

      await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
      await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'visible', timeout: 10_000 });

      await page.keyboard.press('Enter');

      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    });

    await test.step('deploy via manifest', async () => {
      await openFileByName(page, 'package.xml');

      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();

      await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, 'manifest/package.xml');

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

      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 30_000 });
    });

    await test.step('retrieve via manifest', async () => {
      await openFileByName(page, 'package.xml');

      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, 'manifest/package.xml');

      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: RETRIEVE_TIMEOUT });
    });

    await test.step('delete class from org', async () => {
      await openFileByName(page, `${className}.cls`);

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeCommandWithCommandPalette(page, packageNls.delete_source_text);

      const deleteConfirmation = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Are you sure you want to delete this source/i })
        .first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });

      const deleteButton = deleteConfirmation.getByRole('button', { name: /Delete Source/i });
      await deleteButton.click();

      await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 240_000 });
    });

    await test.step('delete class locally', async () => {
      // After deleting from org, the file may have been deleted locally too
      // Check if file still exists before trying to delete it locally
      const explorerFile = page
        .locator('[role="treeitem"]')
        .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
      const fileExists = await explorerFile.count().then(count => count > 0);

      if (fileExists) {
        await expect(explorerFile).toBeVisible();

        // Delete file using explorer context menu
        await executeExplorerContextMenuCommand(page, new RegExp(`${className}\\.cls$`, 'i'), /Delete Permanently/i);

        // Wait for VS Code delete confirmation dialog
        const deleteDialog = page
          .getByRole('dialog')
          .filter({ hasText: /Are you sure you want to permanently delete/i });
        await expect(deleteDialog).toBeVisible({ timeout: 10_000 });

        // Click Delete button in the dialog
        const deleteButton = deleteDialog.getByRole('button', { name: /^Delete$/i });
        await deleteButton.click();

        // Wait for file to disappear from explorer
        await expect(async () => {
          const count = await page
            .locator('[role="treeitem"]')
            .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') })
            .count();
          expect(count, `File ${className}.cls should not be in explorer`).toBe(0);
        }).toPass({ timeout: 30_000 });
      }
      // If file doesn't exist, it was already deleted when we deleted from org (expected behavior)
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
