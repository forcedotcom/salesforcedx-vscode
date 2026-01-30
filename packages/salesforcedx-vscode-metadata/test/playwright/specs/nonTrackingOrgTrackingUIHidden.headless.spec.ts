/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nonTrackingTest as test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  isDesktop,
  HUB_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

// we skip this on the web, locally, because your hub might not be aliased as 'hub'.
// It works without tracking, but there's no way to set that in the webfs auth files, even if it's set correctly locally
// in CI, we use the devhub on the web
(isDesktop() || process.env.CI ? test : test.skip.bind(test))(
  'Non-Tracking Org: tracking UI elements are hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup non-tracking org', async () => {
      const createResult = await createNonTrackingOrg(isDesktop() ? NON_TRACKING_ORG_ALIAS : HUB_ORG_ALIAS);
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });

      // Wait for connection to be established and org info to be populated
      // The status bar will only appear if tracksSource is true, so we wait for it to NOT appear
      // This ensures the org info has been refreshed and the context is set correctly
      const statusBarPage = new SourceTrackingStatusBarPage(page);

      // Wait up to 30 seconds for the connection to establish
      // If the status bar appears, it means tracking is enabled (test will fail)
      // If it doesn't appear, we know the org is correctly detected as non-tracking
      await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: 30_000 });
    });

    await test.step('verify status bar widget does not appear', async () => {
      const statusBarPage = new SourceTrackingStatusBarPage(page);
      // The status bar should not appear for non-tracking orgs
      // We already verified this in setup, but check again to be sure
      await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: 5000 });
    });

    await test.step('verify reset tracking command does not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.reset_remote_tracking_text);
    });

    await test.step('verify view changes commands do not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.view_all_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_local_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_remote_changes_text);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
