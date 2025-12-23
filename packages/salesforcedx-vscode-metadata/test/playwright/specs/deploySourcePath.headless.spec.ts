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
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  saveScreenshot,
  isMacDesktop,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

test.describe('Deploy Source Path', () => {
  // eslint-disable-next-line jest/unbound-method
  (isMacDesktop() ? test.skip : test)('deploys via all entry points', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;
    let statusBarPage: SourceTrackingStatusBarPage;

    await test.step('setup minimal org and disable deploy-on-save', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'setup.after-status-bar-visible.png');

      // Disable deploy-on-save so test can control when deploys happen
      // upsertSettings already takes a screenshot after setting
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');

      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'setup.complete.png');
    });

    await test.step('1. Editor context menu', async () => {
      className = `DeploySourcePathTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Close any open editors to ensure clean state
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
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

      // Right-click editor → "SFDX: Deploy This Source to Org"
      await executeEditorContextMenuCommand(page, packageNls.deploy_this_source_text, `${className}.cls`);
      await saveScreenshot(page, 'step1.after-context-menu-command.png');

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.deploy-complete.png');
    });

    await test.step('2. Explorer context menu (file)', async () => {
      // Close any open editors to ensure clean state
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
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
      await page.locator('.monaco-editor').first().waitFor({ state: 'visible', timeout: 5000 });

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

      // Right-click file in explorer → "SFDX: Deploy This Source to Org"
      // Match .cls but not .cls-meta.xml
      await saveScreenshot(page, 'step2.before-explorer-context-menu.png');
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}\\.cls(?!-meta\\.xml)`),
        packageNls.deploy_this_source_text
      );
      await saveScreenshot(page, 'step2.after-explorer-context-menu-command.png');

      // Check for deploy-related error notifications before waiting for deploying notification
      const allNotifications = page.locator('.monaco-workbench .notification-list-item');
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
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step2.deploy-complete.png');
    });

    await test.step('3. Explorer context menu (directory)', async () => {
      // Close any open editors to ensure clean state
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
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

      // Right-click "classes" folder → "SFDX: Deploy This Source to Org"
      await saveScreenshot(page, 'step4.before-explorer-context-menu.png');
      await executeExplorerContextMenuCommand(page, /classes/i, packageNls.deploy_this_source_text);
      await saveScreenshot(page, 'step3.after-explorer-context-menu-command.png');

      // Check for deploy-related error notifications before waiting for deploying notification
      const allNotifications = page.locator('.monaco-workbench .notification-list-item');
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
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step3.deploy-complete.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
