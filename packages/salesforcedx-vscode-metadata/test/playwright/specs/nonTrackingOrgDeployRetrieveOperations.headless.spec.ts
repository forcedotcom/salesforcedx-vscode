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
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  isDesktop,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { nls } from '../../../src/messages';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';

(isDesktop() ? test : test.skip.bind(test))(
  'Non-Tracking Org: deploy/retrieve operations work without tracking',
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

    await test.step('deploy class to org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

      // Check for deploy error notifications
      const postDeployNotifications = page.locator(NOTIFICATION_LIST_ITEM);
      const deployErrorPattern = new RegExp(
        `${nls.localize('deploy_completed_with_errors_message')}|${nls.localize('deploy_failed', '.*')}`,
        'i'
      );
      const deployErrorNotification = postDeployNotifications.filter({ hasText: deployErrorPattern }).first();
      const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasDeployError) {
        const errorText = await deployErrorNotification.textContent();
        throw new Error(`Deploy failed with error notification: ${errorText}`);
      }

      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 30_000 });
    });

    await test.step('retrieve class from org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);

      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: RETRIEVE_TIMEOUT });
    });

    await test.step('delete class from org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');

      await executeCommandWithCommandPalette(page, packageNls.delete_source_text);

      const deleteConfirmation = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: nls.localize('delete_source_confirmation_message') })
        .first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });

      const deleteButton = deleteConfirmation.getByRole('button', { name: nls.localize('confirm_delete_source_button_text') });
      await deleteButton.click();

      await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: DEPLOY_TIMEOUT });

      // Verify file was deleted from local filesystem (delete from org also deletes from project)
      await expect(async () => {
        const count = await page
          .locator('[role="treeitem"]')
          .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') })
          .count();
        expect(count, `File ${className}.cls should not be in explorer after delete from org`).toBe(0);
      }).toPass({ timeout: 30_000 });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
