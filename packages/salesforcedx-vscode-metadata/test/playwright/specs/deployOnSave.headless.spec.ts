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
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  createApexClass,
  editOpenFile,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';

test.describe('Deploy On Save', () => {
  test('automatically deploys when file is saved', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup minimal org and enable deploy-on-save', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Wait for extension to fully activate (needed for desktop settings to be available)
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await waitForOutputChannelText(page, {
        expectedText: 'Salesforce Metadata activation complete',
        timeout: 30_000
      });

      // Enable deploy-on-save (web already enabled by default, desktop needs this)
      const isDesktop = process.env.VSCODE_DESKTOP === '1';
      if (isDesktop) {
        await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'true' });
      }

      // Verify deploy-on-save service is initialized by checking output channel
      await waitForOutputChannelText(page, { expectedText: 'Deploy on save service initialized', timeout: 30_000 });

      await closeWelcomeTabs(page);
    });

    await test.step('create apex class', async () => {
      const className = `DeployOnSaveTest${Date.now()}`;
      await createApexClass(page, className);
    });

    await test.step('edit class and save to trigger deploy', async () => {
      await editOpenFile(page, 'Deploy on save test comment');
    });

    await test.step('verify deploying notification appears and disappears', async () => {
      // Wait for deploy-on-save to trigger (service has 1s delay, then deploy starts)
      // Check output channel first to verify deploy-on-save is working
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await waitForOutputChannelText(page, { expectedText: 'Deploy on save triggered', timeout: 30_000 });

      // Now wait for the deploying notification
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 600_000 });
    });

    await test.step('verify output channel shows deploy success', async () => {
      // Output channel already open from previous step
      // Check for completion message
      await waitForOutputChannelText(page, { expectedText: 'Deploy on save complete', timeout: 240_000 });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
