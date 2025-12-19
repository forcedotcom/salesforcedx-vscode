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
  executeCommandWithCommandPalette,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

test.describe('Deploy Source Path', () => {
  test('deploys via command palette (active editor)', async ({ page }) => {
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

    await test.step('Command palette (active editor)', async () => {
      className = `DeploySourcePathTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Verify local count increments to 1
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step1.after-local-count-1.png');

      // Execute via command palette
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      await saveScreenshot(page, 'step1.after-command-palette.png');

      // Verify deploy progress notification appears then disappears
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

      // Verify local count returns to 0
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.deploy-complete.png');
    });

    await test.step('validate no critical errors', async () => {
      const criticalConsole = filterErrors(consoleErrors);
      const criticalNetwork = filterNetworkErrors(networkErrors);
      expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
      expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
    });
  });
});
