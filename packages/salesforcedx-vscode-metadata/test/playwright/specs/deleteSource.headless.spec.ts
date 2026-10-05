/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers delete-from-project-and-org: creates a throwaway class, deploys it, then deletes it from
 * project + org, asserting completion from the "Deleted Source" output line and the file leaving the
 * explorer.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org, so
 * the shared mounted fixture and seeded classes are untouched by this uniquely-named throwaway class.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  clickModalDialogButton,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

test.setTimeout(DEPLOY_TIMEOUT);

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Delete Source: deletes file from project and org via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage | undefined;

  await test.step('setup', async () => {
    if (isContainer) {
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'deleteSource.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'setup.after-status-bar-visible.png');

      // Disable deploy-on-save to control when deploys happen
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');
      await saveScreenshot(page, 'setup.complete.png');

      // Wait for core commands to be available
      await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);
    }
  });

  await test.step('create and deploy apex class', async () => {
    className = `DeleteSourceTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    if (isContainer) {
      // Focus the freshly created class and wait until the palette deploy command is contributed for
      // it. The editor context keys (sf:in_package_directories) settle a beat after the file opens, so
      // deploying immediately can miss the "SFDX: Deploy This Source to Org" palette entry.
      const createdEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await createdEditor.waitFor({ state: 'visible', timeout: 15_000 });
      await createdEditor.click();
      await verifyCommandExists(page, messages.deploy_this_source_text, 60_000);
    } else {
      // Verify local count increments
      await statusBarPage!.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step1.after-local-count-1.png');
    }

    // Prepare output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    if (isContainer) {
      await clearOutputChannel(page);
    }

    // Deploy the class first so it exists in the org
    await executeCommandWithCommandPalette(page, messages.deploy_this_source_text);
    await saveScreenshot(page, 'step1.after-deploy-command.png');

    const verifyDeployCompleteContainer = async (): Promise<void> => {
      // The transient "Deploying" toast can be missed on a fast container deploy; assert completion via
      // the output channel instead.
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'step1.deploy-complete.png');
    };
    const verifyDeployCompleteDesktop = async (): Promise<void> => {
      // Verify deploy starts and completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'step1.deploy-complete.png');

      // Verify local count returns to 0
      await statusBarPage!.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.after-deploy-count-0.png');
    };
    await (isContainer ? verifyDeployCompleteContainer : verifyDeployCompleteDesktop)();
  });

  await test.step('delete source file from project and org', async () => {
    // File should already be open from createApexClass step
    await saveScreenshot(page, 'step2.file-already-open.png');

    // Verify file is visible in explorer before deletion
    const explorerFileBefore = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
    await expect(explorerFileBefore.first()).toBeVisible();
    await saveScreenshot(page, 'step2.file-in-explorer-before-delete.png');

    // Clear output so deploy output from step 1 doesn't match delete assertions
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    if (isContainer) {
      // Querying the output channel above can shift focus off the class editor; the Delete command's
      // when-clause needs it active, so re-focus before invoking the palette.
      await page.locator(`[data-uri*="${className}.cls"]`).first().click();
    }

    // Execute delete command via command palette
    await executeCommandWithCommandPalette(page, messages.delete_source_text);
    await saveScreenshot(page, 'step2.after-delete-command.png');

    // Wait for the destructive confirmation modal
    const deleteConfirmation = page.locator('.monaco-dialog-box, .dialog-shadow').first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
    await expect(deleteConfirmation).toContainText(messages.delete_source_confirmation_message);
    await saveScreenshot(page, 'step2.confirmation-modal-visible.png');

    // Click "Delete Source" button to confirm
    await clickModalDialogButton(page, messages.confirm_delete_source_button_text);
    await saveScreenshot(page, 'step2.after-confirm-deletion.png');

    // Wait for delete operation to complete via output channel
    await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
    await saveScreenshot(page, 'step2.delete-started.png');

    await waitForOutputChannelText(page, { expectedText: 'Deleted Source', timeout: DEPLOY_TIMEOUT });
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
