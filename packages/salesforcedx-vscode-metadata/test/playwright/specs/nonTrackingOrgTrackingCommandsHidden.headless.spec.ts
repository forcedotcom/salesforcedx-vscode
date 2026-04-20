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
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  isDesktop
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

(isDesktop() ? test : test.skip.bind(test))(
  'Non-Tracking Org: source tracking commands and status bar hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup non-tracking org', async () => {
      const createResult = await createNonTrackingOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    });

    // Wait for extension activation: LWC create is gated on sf:project_opened only,
    // so its presence confirms the metadata extension is fully initialized before
    // we assert tracking commands are absent (avoids false passes on slow startup).
    await test.step('verify extension-activated commands are present', async () => {
      await verifyCommandExists(page, packageNls.lightning_generate_lwc_text, 30_000);
      await verifyCommandExists(page, packageNls.sobjects_refresh);
    });

    await test.step('verify push/pull and view-changes commands do not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.project_deploy_start_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.project_retrieve_start_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.project_retrieve_start_ignore_conflicts_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.view_all_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_local_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_remote_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.reset_remote_tracking_text);
    });

    await test.step('verify source tracking status bar is not visible', async () => {
      const statusBar = new SourceTrackingStatusBarPage(page);
      await expect(statusBar.statusBarItem).not.toBeVisible({ timeout: 30_000 });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
