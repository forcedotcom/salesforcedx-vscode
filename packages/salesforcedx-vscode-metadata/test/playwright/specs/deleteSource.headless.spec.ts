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
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

test('Delete Source: deletes file from project and org via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and disable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    // Disable deploy-on-save to control when deploys happen
    await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create and deploy apex class', async () => {
    className = `DeleteSourceTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // Verify local count increments
    await statusBarPage.waitForCounts({ local: 1 }, 60_000);
    await saveScreenshot(page, 'step1.after-local-count-1.png');

    // Prepare output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    // Deploy the class first so it exists in the org
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await saveScreenshot(page, 'step1.after-deploy-command.png');

    // Verify deploy starts and completes
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
    await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
    await saveScreenshot(page, 'step1.deploy-complete.png');

    // Verify local count returns to 0
    await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    await saveScreenshot(page, 'step1.after-deploy-count-0.png');
  });

  await test.step('delete source file from project and org', async () => {
    // File should already be open from createApexClass step
    await saveScreenshot(page, 'step2.file-already-open.png');

    // Verify file is visible in explorer before deletion
    const explorerFileBefore = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
    await expect(explorerFileBefore).toBeVisible();
    await saveScreenshot(page, 'step2.file-in-explorer-before-delete.png');

    // Execute delete command via command palette
    await executeCommandWithCommandPalette(page, packageNls.delete_source_text);
    await saveScreenshot(page, 'step2.after-delete-command.png');

    // Wait for confirmation notification with "Delete Source" button
    const deleteConfirmation = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Are you sure you want to delete this source/i })
      .first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step2.confirmation-notification-visible.png');

    // Click "Delete Source" button to confirm
    const deleteButton = deleteConfirmation.getByRole('button', { name: /Delete Source/i });
    await deleteButton.click();
    await saveScreenshot(page, 'step2.after-confirm-deletion.png');

    // Wait for delete operation to complete via output channel
    await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
    await saveScreenshot(page, 'step2.delete-started.png');

    // Delete uses deploy output format, so look for "deployed"
    await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 240_000 });
    await saveScreenshot(page, 'step2.delete-complete.png');

    // Verify file is no longer visible in explorer
    // Wait for file to disappear - use longer timeout for desktop explorer refresh
    await expect(async () => {
      expect(
        await page
          .locator('[role="treeitem"]')
          .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') })
          .count(),
        `File ${className}.cls should not be in explorer`
      ).toBe(0);
    }).toPass({ timeout: 60_000 });
    await saveScreenshot(page, 'step2.file-removed-from-explorer.png');

    // Note: Editor tab may remain open with strikethrough (normal VS Code behavior for deleted files)
    await saveScreenshot(page, 'step2.final-state.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
