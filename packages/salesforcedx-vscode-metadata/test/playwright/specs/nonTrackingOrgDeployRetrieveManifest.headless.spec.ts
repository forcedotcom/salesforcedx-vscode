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
  createApexClass,
  executeEditorContextMenuCommand,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  isDesktop,
  isMacDesktop,
  QUICK_INPUT_WIDGET,
  EDITOR,
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';

(isDesktop() && !isMacDesktop() ? test : test.skip.bind(test))(
  'Non-Tracking Org: deploy/retrieve via manifest work without tracking',
  async ({ page }) => {
    test.setTimeout(RETRIEVE_TIMEOUT);

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;

    await test.step('setup non-tracking org', async () => {
      const createResult = await createNonTrackingOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    });

    await test.step('create apex class', async () => {
      className = `NonTrackingTest${Date.now()}`;
      await createApexClass(page, className);
    });

    await test.step('generate manifest from apex class', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
      await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'visible', timeout: 10_000 });

      await page.keyboard.press('Enter');

      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    });

    await test.step('deploy via manifest', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, 'manifest/package.xml');

      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 30_000 });
    });

    await test.step('retrieve via manifest', async () => {


      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, 'manifest/package.xml');

      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: RETRIEVE_TIMEOUT });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
