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
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  editOpenFile,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

test.describe('Deploy Source Path', () => {
  test('deploys via all entry points', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;
    let statusBarPage: SourceTrackingStatusBarPage;

    await test.step('setup minimal org and disable deploy-on-save', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await closeWelcomeTabs(page);
    });

    await test.step('1. Command palette (active editor)', async () => {
      className = `DeploySourcePathTest${Date.now()}`;
      await createApexClass(page, className);

      // Verify local count increments to 1
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Execute via command palette
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

      // Verify deploy progress notification appears then disappears
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

      // Verify local count returns to 0
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    });

    await test.step('2. Editor context menu', async () => {
      // Edit class to create new local change
      await editOpenFile(page, 'Editor context menu test');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Right-click editor → "SFDX: Deploy This Source to Org"
      await executeEditorContextMenuCommand(page, packageNls.deploy_this_source_text);

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    });

    await test.step('3. Explorer context menu (file)', async () => {
      // Edit class again
      await editOpenFile(page, 'Explorer file context menu test');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Right-click file in explorer → "SFDX: Deploy This Source to Org"
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}\\.cls`),
        packageNls.deploy_this_source_text
      );

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    });

    await test.step('4. Explorer context menu (directory)', async () => {
      // Edit class again
      await editOpenFile(page, 'Explorer directory context menu test');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Right-click "classes" folder → "SFDX: Deploy This Source to Org"
      await executeExplorerContextMenuCommand(page, /classes/i, packageNls.deploy_this_source_text);

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    });

    await test.step('validate no critical errors', async () => {
      const criticalConsole = filterErrors(consoleErrors);
      const criticalNetwork = filterNetworkErrors(networkErrors);
      expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
      expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
    });
  });
});
