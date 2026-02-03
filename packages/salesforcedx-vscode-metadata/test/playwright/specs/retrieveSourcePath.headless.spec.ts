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
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  upsertSettings
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';

// Skip on Mac desktop (right-click doesn't work)
(isMacDesktop() ? test.skip.bind(test) : test)(
  'Retrieve Source Path: retrieves file via explorer context menu',
  async ({ page }) => {
    test.setTimeout(RETRIEVE_TIMEOUT);

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;
    let statusBarPage: SourceTrackingStatusBarPage;

    await test.step('setup minimal org', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'setup.after-status-bar-visible.png');
      await saveScreenshot(page, 'setup.complete.png');
      await upsertSettings(page, { 'salesforcedx-vscode-metadata.deployOnSave.enabled': 'false' });

    });

    await test.step('create local apex class, deploy to org, and make remote change', async () => {
      // Create apex class locally
      className = `RetrieveSourcePathTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Wait for local count to increment
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      const countsAfterCreate = await statusBarPage.getCounts();
      await saveScreenshot(
        page,
        `step1.after-create-counts-${countsAfterCreate.local}-${countsAfterCreate.remote}.png`
      );

      // Deploy class to org so it exists for retrieve
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.after-deploy.png');

      // Simulate remote change by making a local edit
      // This creates a scenario where the file exists remotely but differs locally
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'Remote change simulation');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step1.after-edit.png');

    });

    await test.step('retrieve file via explorer context menu', async () => {
      const initialCounts = await statusBarPage.getCounts();
      await saveScreenshot(page, `step2.initial-counts-${initialCounts.local}-${initialCounts.remote}.png`);

      // Prepare output channel before triggering command
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      // Right-click the apex class file in explorer and select retrieve
      const classFilePattern = new RegExp(`${className}\\.cls$`, 'i');
      await executeExplorerContextMenuCommand(page, classFilePattern, packageNls.retrieve_this_source_text);
      await saveScreenshot(page, 'step2.after-context-menu.png');

      // Verify retrieve starts and completes via output channel
      // Retrieve operations may not show progress notifications consistently across platforms
      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await saveScreenshot(page, 'step2.retrieve-started.png');

      await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: RETRIEVE_TIMEOUT });
      await saveScreenshot(page, 'step2.retrieve-complete.png');

      // After retrieve, local count should decrease (file retrieved from org)
      // We verify the retrieve operation completed successfully
      await saveScreenshot(page, 'step2.final-state.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
