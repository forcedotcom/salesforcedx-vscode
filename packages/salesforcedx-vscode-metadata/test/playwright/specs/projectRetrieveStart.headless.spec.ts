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
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  saveScreenshot,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';
import packageNls from '../../../package.nls.json';

test('Project Retrieve Start: retrieves source from org', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('retrieve source from org', async () => {
    // Get initial counts
    const initialCounts = await statusBarPage.getCounts();
    await saveScreenshot(page, `step1.initial-counts-${initialCounts.local}-${initialCounts.remote}-${initialCounts.conflicts}.png`);

    // Execute retrieve via command palette
    await executeCommandWithCommandPalette(page, packageNls.project_retrieve_start_default_org_text);
    await saveScreenshot(page, 'step1.after-command-palette.png');

    // Verify retrieve progress notification appears then disappears
    const retrievingNotification = await waitForRetrieveProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'step1.retrieve-notification-appeared.png');
    await expect(retrievingNotification).not.toBeVisible({ timeout: 240_000 });
    await saveScreenshot(page, 'step1.retrieve-complete.png');

    // After retrieve, remote count should be 0 (all remote changes pulled)
    await statusBarPage.waitForCounts({ remote: 0 }, 60_000);
    await saveScreenshot(page, 'step1.after-retrieve-remote-0.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
