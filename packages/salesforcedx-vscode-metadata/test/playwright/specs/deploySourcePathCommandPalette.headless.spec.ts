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
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org,
 * with a uniquely-named throwaway class. Source-tracking counts are asserted relative to a baseline
 * taken at setup: the container's fixture components aren't deployed to its boot org (5 local changes
 * on a fresh org), and earlier specs on the shared, persistent workbench can add more.
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
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  NOTIFICATION_LIST_ITEM,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses } from '../utils/containerCleanup';

// Container-only: throwaway classes this test created, deleted from the project and org after it (pass
// or fail) so they don't pile up on the shared workbench — see utils/containerCleanup.
const createdClasses: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
  test.afterEach(() => {
    cleanupContainerApexClasses(createdClasses.splice(0));
  });
}

test('Deploy Source Path: deploys via command palette (active editor)', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `DeployPaletteTest${Date.now()}`;
  createdClasses.push(className);
  let statusBarPage: SourceTrackingStatusBarPage;
  // Local-change count before this spec's class exists: 0 on desktop's fresh project, non-zero on the
  // container (fixture components not yet in its boot org, plus anything earlier specs left).
  let baselineLocal: number;

  await test.step('setup', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');
    }

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    // Disable deploy-on-save so test can control when deploys happen
    // upsertSettings already takes a screenshot after setting
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');
    baselineLocal = (await statusBarPage.getCounts()).local;

    // Wait for core commands to be available
    await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);

    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('Command palette (active editor)', async () => {
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // Verify local count increments by 1
    await statusBarPage.waitForCounts({ local: baselineLocal + 1 }, 60_000);
    await saveScreenshot(page, 'step1.after-local-count-1.png');

    // Clear the metadata output channel so the "Deployed Source" wait below only matches this deploy.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    // Querying the output channel shifts focus off the class editor; the palette command runs on the
    // active editor, so re-focus it and wait until the command is contributed for it.
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await apexEditor.click();
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);

    // Execute via command palette
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await saveScreenshot(page, 'step1.after-command-palette.png');

    // Verify deploy progress notification appears then disappears, and the deploy finished cleanly
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });

    const deployError = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
      .first();
    const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      const text = await deployError.textContent();
      throw new Error(`Deploy failed with error notification: ${text}`);
    }

    // Verify local count returns to the baseline
    await statusBarPage.waitForCounts({ local: baselineLocal }, 60_000);
    await saveScreenshot(page, 'step1.deploy-complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
