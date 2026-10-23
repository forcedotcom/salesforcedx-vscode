/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the Deploy This Source entry points: reachable from the editor context menu, the explorer
 * file context menu, and the explorer folder context menu, each running a deploy to completion with
 * no error notification.
 *
 * Container: deploys the seeded fixture class (PagedResult.cls) through each entry point without
 * editing it, so the shared mounted fixture is not mutated. Absolute source-tracking counts are
 * intentionally not asserted in the container because specs share one persistent workbench and org.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  editOpenFile,
  EDITOR,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  clearOutputChannel,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  openFileFromExplorerTree,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

const CLASS_PATH = ['force-app', 'main', 'default', 'classes'];

/** Fail if a deploy-error notification is present. */
const assertNoDeployError = async (page: Page): Promise<void> => {
  const deployError = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
    .first();
  const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasError) {
    const text = await deployError.textContent();
    throw new Error(`Deploy failed with error notification: ${text}`);
  }
};

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Deploy Source Path: deploys via all entry points', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Container deploys the seeded fixture class as-is; desktop/headless create+edit a throwaway class.
  let className = isContainer ? 'PagedResult' : '';
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'deploySourcePath.01-ready.png');
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

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');
      await saveScreenshot(page, 'setup.complete.png');
    }
  });

  await test.step('1. Editor context menu', async () => {
    const prepareEditorContextMenuContainer = async (): Promise<void> => {
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, `${className}.cls`, CLASS_PATH);
        const editor = page.locator(`[data-uri*="${className}.cls"]`).first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);
    };
    const prepareEditorContextMenuDesktop = async (): Promise<void> => {
      className = `DeploySourcePathTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Close any open editors to ensure clean state
      await closeAllEditors(page);
      await saveScreenshot(page, 'step1.after-close-editors.png');

      // Edit class to create new local change
      await openFileByName(page, `${className}.cls`);
      await saveScreenshot(page, 'step1.after-open-file.png');
      // Ensure the editor is focused before editing
      const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await apexEditor.click();
      await editOpenFile(page, 'Editor context menu test');
      await saveScreenshot(page, 'step1.after-edit.png');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step1.after-local-count-1.png');

      // Ensure the editor is focused before right-clicking
      const focusedEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await focusedEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await focusedEditor.click();
      await saveScreenshot(page, 'step1.before-context-menu.png');
    };
    await (isContainer ? prepareEditorContextMenuContainer : prepareEditorContextMenuDesktop)();

    if (isContainer) {
      // Each entry point in this spec deploys the same already-synced content, so repeated deploys can
      // become near-instant no-ops that flash the "Deploying" toast past the 30s poll; assert completion
      // via the output channel instead, as elsewhere in this package.
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
    }

    // Right-click editor → "SFDX: Deploy This Source to Org"
    await executeEditorContextMenuCommand(page, packageNls.deploy_this_source_text, `${className}.cls`);

    const verifyEditorDeployCompleteContainer = async (): Promise<void> => {
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await assertNoDeployError(page);
      await saveScreenshot(page, 'deploySourcePath.03-editor-deployed.png');
    };
    const verifyEditorDeployCompleteDesktop = async (): Promise<void> => {
      await saveScreenshot(page, 'step1.after-context-menu-command.png');

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.deploy-complete.png');
    };
    await (isContainer ? verifyEditorDeployCompleteContainer : verifyEditorDeployCompleteDesktop)();
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);

    if (!isContainer) {
      await saveScreenshot(page, 'step2.after-close-editors.png');

      // Ensure status bar is ready and file is synced (local=0) after step 1 deploy
      await statusBarPage.waitForVisible(10_000);
      await statusBarPage.waitForCounts({ local: 0 }, 30_000);
      await saveScreenshot(page, 'step2.after-sync-confirmed.png');

      // Edit class again to create new local change
      await openFileByName(page, `${className}.cls`);
      await saveScreenshot(page, 'step2.after-open-file.png');

      // Ensure the editor is fully loaded and focused before editing
      const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await apexEditor.click();

      // Wait for editor content to be ready
      await page.locator(EDITOR).first().waitFor({ state: 'visible', timeout: 5000 });

      // Wait for status bar to be ready and showing synced state
      await statusBarPage.waitForVisible(5000);
      const countsBeforeEdit = await statusBarPage.getCounts();
      await saveScreenshot(
        page,
        `step2.before-edit-counts-${countsBeforeEdit.local}-${countsBeforeEdit.remote}-${countsBeforeEdit.conflicts}.png`
      );

      // Ensure editor is still focused before editing
      await apexEditor.click();
      await editOpenFile(page, 'Explorer file context menu test');
      await saveScreenshot(page, 'step2.after-edit.png');

      // Check counts after edit to debug
      const countsAfterEdit = await statusBarPage.getCounts();
      await saveScreenshot(
        page,
        `step2.after-edit-counts-${countsAfterEdit.local}-${countsAfterEdit.remote}-${countsAfterEdit.conflicts}.png`
      );

      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step2.before-explorer-context-menu.png');
    }

    if (isContainer) {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
    }

    // Right-click file in explorer → "SFDX: Deploy This Source to Org"
    // Match .cls but not .cls-meta.xml
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${className}\\.cls(?!-meta\\.xml)`),
      packageNls.deploy_this_source_text
    );

    const verifyExplorerFileDeployCompleteContainer = async (): Promise<void> => {
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await assertNoDeployError(page);
      await saveScreenshot(page, 'deploySourcePath.05-explorer-file-deployed.png');
    };
    const verifyExplorerFileDeployCompleteDesktop = async (): Promise<void> => {
      await saveScreenshot(page, 'step2.after-explorer-context-menu-command.png');

      // Check for deploy-related error notifications before waiting for deploying notification
      const allNotifications = page.locator(NOTIFICATION_LIST_ITEM);
      await saveScreenshot(page, 'step2.checking-notifications.png');
      const deployErrorNotification = allNotifications
        .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
        .first();
      const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasDeployError) {
        await saveScreenshot(page, 'step2.deploy-error.png');
        const errorText = await deployErrorNotification.textContent();
        throw new Error(`Deploy failed with error notification: ${errorText}`);
      }

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step2.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step2.deploy-complete.png');
    };
    await (isContainer ? verifyExplorerFileDeployCompleteContainer : verifyExplorerFileDeployCompleteDesktop)();
  });

  await test.step('3. Explorer context menu (directory)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);

    if (!isContainer) {
      await saveScreenshot(page, 'step3.after-close-editors.png');

      // Ensure status bar is ready and file is synced (local=0) after step 2 deploy
      await statusBarPage.waitForVisible(10_000);
      await statusBarPage.waitForCounts({ local: 0 }, 30_000);
      await saveScreenshot(page, 'step3.after-sync-confirmed.png');

      // Edit class again to create new local change
      await openFileByName(page, `${className}.cls`);
      await saveScreenshot(page, 'step3.after-open-file.png');
      // Ensure the editor is focused before editing
      const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await apexEditor.click();
      await editOpenFile(page, 'Explorer directory context menu test');
      await saveScreenshot(page, 'step3.after-edit.png');
      const countsAfterEdit = await statusBarPage.getCounts();
      await saveScreenshot(
        page,
        `step3.after-edit-counts-${countsAfterEdit.local}-${countsAfterEdit.remote}-${countsAfterEdit.conflicts}.png`
      );
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step3.after-local-count-1.png');
      await saveScreenshot(page, 'step4.before-explorer-context-menu.png');
    }

    if (isContainer) {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
    }

    // Right-click "classes" folder → "SFDX: Deploy This Source to Org"
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.deploy_this_source_text);

    const verifyExplorerDirDeployCompleteContainer = async (): Promise<void> => {
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await assertNoDeployError(page);
      await saveScreenshot(page, 'deploySourcePath.07-explorer-dir-deployed.png');
    };
    const verifyExplorerDirDeployCompleteDesktop = async (): Promise<void> => {
      await saveScreenshot(page, 'step3.after-explorer-context-menu-command.png');

      // Check for deploy-related error notifications before waiting for deploying notification
      const allNotifications = page.locator(NOTIFICATION_LIST_ITEM);
      await saveScreenshot(page, 'step3.checking-notifications.png');
      const deployErrorNotification = allNotifications
        .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
        .first();
      const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasDeployError) {
        await saveScreenshot(page, 'step3.deploy-error.png');
        const errorText = await deployErrorNotification.textContent();
        throw new Error(`Deploy failed with error notification: ${errorText}`);
      }

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step3.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step3.deploy-complete.png');
    };
    await (isContainer ? verifyExplorerDirDeployCompleteContainer : verifyExplorerDirDeployCompleteDesktop)();
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
