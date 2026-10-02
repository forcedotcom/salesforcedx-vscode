/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the Deploy This Source command-palette entry point for the active editor, asserting the
 * deploy runs to completion with no error notification.
 *
 * Container: deploys the seeded fixture class (ExampleClass.cls) as the active editor without editing
 * it, so the shared mounted fixture is not mutated.
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
  saveScreenshot,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  NOTIFICATION_LIST_ITEM,
  openFileFromExplorerTree,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Deploy Source Path: deploys via command palette (active editor)', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'deploySourcePathCommandPalette.01-ready.png');
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
      // upsertSettings already takes a screenshot after setting
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');

      // Wait for core commands to be available
      await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);

      await saveScreenshot(page, 'setup.complete.png');
    }
  });

  await test.step('Command palette (active editor)', async () => {
    if (isContainer) {
      // Use the seeded fixture class rather than mutating the shared workbench with a new one.
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator('[data-uri*="ExampleClass.cls"]').first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);
    } else {
      const className = `DeploySourcePathTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Verify local count increments to 1
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step1.after-local-count-1.png');
    }

    // Execute via command palette
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    if (!isContainer) {
      await saveScreenshot(page, 'step1.after-command-palette.png');
    }

    // Verify deploy progress notification appears then disappears
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(
      page,
      isContainer ? 'deploySourcePathCommandPalette.02-deploying.png' : 'step1.deploy-notification-appeared.png'
    );
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    if (isContainer) {
      await saveScreenshot(page, 'deploySourcePathCommandPalette.03-deployed.png');

      const deployError = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
        .first();
      const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasError) {
        const text = await deployError.textContent();
        throw new Error(`Deploy failed with error notification: ${text}`);
      }
    } else {
      // Verify local count returns to 0
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.deploy-complete.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
