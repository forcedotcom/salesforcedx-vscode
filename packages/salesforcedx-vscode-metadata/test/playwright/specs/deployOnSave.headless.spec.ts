/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers deploy-on-save: enabling the setting and saving a file triggers an automatic deploy that
 * runs to completion, verified via the progress notification and the "Deployed Source" output-channel
 * line.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org,
 * with a uniquely-named throwaway class so the shared, persistent workbench never collides with a
 * prior run's files.
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
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  createApexClass,
  editOpenFile,
  clearOutputChannel,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { DEPLOY_TIMEOUT } from '../../constants';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Deploy On Save: automatically deploys when file is saved', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup and enable deploy-on-save', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }

    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);
    await saveScreenshot(page, 'deployOnSave.01-ready.png');

    // Enable deploy-on-save using settings UI
    // Note: useMetadataExtensionCommands is set in desktop fixtures to ensure deploy-on-save service processes saves
    // The Settings-UI search row can transiently flake on the container's shared workbench;
    // upsertSettings only toggles when the current value differs, so retrying the call is idempotent.
    await expect(async () => {
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'true' });
    }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });

    const verifyDeployOnSaveServiceInitialized = async (): Promise<void> => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await waitForOutputChannelText(page, { expectedText: 'Deploy on save service initialized', timeout: 30_000 });
    };
    // The service logs its init line once, at extension activation. On the container's shared
    // workbench that happened long before this spec, and earlier specs may have cleared the channel, so
    // only desktop (fresh window) can rely on seeing it; the save-triggered deploy below is the signal
    // on both.
    if (!isContainer) {
      await verifyDeployOnSaveServiceInitialized();
    }
  });

  await test.step('edit class and save to trigger deploy', async () => {
    const className = `DeployOnSaveTest${Date.now()}`;
    await createApexClass(page, className);

    // Clear the metadata output channel so the "Deployed Source" assertion reflects this save, not a
    // prior deploy.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);

    // Querying the output channel shifts focus off the class editor; re-focus so the edit lands in it.
    await page.locator(`[data-uri*="${className}.cls"]`).first().click();
    await editOpenFile(page, 'Deploy on save test comment');
    await saveScreenshot(page, 'deployOnSave.02-after-edit-and-save.png');
  });

  await test.step('verify deploy triggers and completes', async () => {
    // Deploy should start within 5 seconds on desktop (1s service delay + deploy start); the container
    // allows up to 30s for the shared, contended workbench.
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, isContainer ? 30_000 : 5000);
    await saveScreenshot(page, 'deployOnSave.03-deploy-notification.png');

    // Wait for deploy to complete (notification disappears)
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deployOnSave.04-deploy-complete.png');

    // Also verify in output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 10_000 });
    await saveScreenshot(page, 'deployOnSave.05-deployed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
