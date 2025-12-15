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
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  executeCommandWithCommandPalette,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  EDITOR_WITH_URI,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { editOpenFile } from '../utils/apexFileHelpers';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

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

    await test.step('validate no critical errors', async () => {
      const criticalConsole = filterErrors(consoleErrors);
      const criticalNetwork = filterNetworkErrors(networkErrors);
      expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
      expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
    });
  });
});
