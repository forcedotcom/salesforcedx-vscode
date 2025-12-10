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
  closeSettingsTab,
  create,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  upsertSettings,
  NOTIFICATION_LIST_ITEM,
  EDITOR_WITH_URI,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { editOpenFile } from '../utils/apexFileHelpers';
import packageNls from '../../../package.nls.json';

test.describe('Source Tracking Status Bar', () => {
  test('tracks remote and local changes through full deploy cycle', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const statusBarPage = await test.step('setup scratch org and wait for status bar', async () => {
      const createResult = await create();
      await waitForVSCodeWorkbench(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { 'salesforcedx-vscode-metadata.deployOnSave.enabled': 'false' });

      const statusBar = new SourceTrackingStatusBarPage(page);
      await statusBar.waitForVisible(120_000);
      await closeWelcomeTabs(page);
      return statusBar;
    });

    await test.step('verify initial state shows remote changes', async () => {
      const initialCounts = await statusBarPage.getCounts();
      expect(initialCounts.remote, 'Remote changes should be > 0 after dreamhouse deployment').toBeGreaterThan(0);
      expect(initialCounts.local, 'Local changes should be 0 initially').toBe(0);
      expect(initialCounts.conflicts, 'Conflicts should be 0 initially').toBe(0);

      const hasError = await statusBarPage.hasErrorBackground();
      expect(hasError, 'Status bar should not have error background when conflicts = 0').toBe(false);
    });

    await test.step('create new apex class', async () => {
      const className = `TestClass${Date.now()}`;

      // Close Settings tab to avoid focus issues
      await closeSettingsTab(page);
      await closeWelcomeTabs(page);

      await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);

      // First prompt: "Enter Apex class name"
      await page
        .locator(QUICK_INPUT_WIDGET)
        .getByText(/Enter Apex class name/i)
        .waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.type(className);
      await page.keyboard.press('Enter');

      // Second prompt: Quick Pick to select output directory - just press Enter to accept default
      await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Enter');

      // Wait for the editor to open with the new class
      await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });
    });

    await test.step('verify local count increments to 1', async () => {
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
    });

    await test.step('edit class and verify count stays at 1', async () => {
      await editOpenFile(page, 'Modified for testing');
      const afterEditCounts = await statusBarPage.getCounts();
      expect(afterEditCounts.local, 'Local count should stay at 1 after editing existing change').toBe(1);
    });

    await test.step('deploy changes and verify local count returns to 0', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
      await waitForDeployProgressNotificationToAppear(page, 30_000);

      const deployingNotification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Deploying/i })
        .first();
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
