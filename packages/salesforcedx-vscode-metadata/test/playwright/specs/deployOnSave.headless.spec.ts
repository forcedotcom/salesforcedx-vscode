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
  upsertSettings,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  createApexClass,
  editOpenFile,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { DEPLOY_TIMEOUT } from '../../constants';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';

test('Deploy On Save: automatically deploys when file is saved', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org and enable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    // Wait for extension to fully activate (needed for desktop settings to be available)
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, {
      expectedText: 'Salesforce Metadata activation complete',
      timeout: 30_000
    });

    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);

    // Enable deploy-on-save using settings UI
    // Note: useMetadataExtensionCommands is set in desktop fixtures to ensure deploy-on-save service processes saves
    await upsertSettings(page, {
      [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'true'
    });

    // Verify deploy-on-save service is initialized by checking output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, { expectedText: 'Deploy on save service initialized', timeout: 30_000 });
  });

  await test.step('create apex class', async () => {
    const className = `DeployOnSaveTest${Date.now()}`;
    await createApexClass(page, className);
  });

  await test.step('edit class and save to trigger deploy', async () => {
    await editOpenFile(page, 'Deploy on save test comment');
    await saveScreenshot(page, 'after-edit-and-save.png');
  });

  await test.step('verify deploy triggers and completes', async () => {
    // Deploy should start within 5 seconds (1s service delay + deploy start)
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 5000);
    await saveScreenshot(page, 'deploy-notification-appeared.png');

    // Wait for deploy to complete (notification disappears)
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deploy-complete.png');

    // Also verify in output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
