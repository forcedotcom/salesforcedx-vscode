/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for deploy-on-save. The web twin (deployOnSave.headless.spec.ts) proves
 * that saving a file triggers the deploy-on-save service against a plain Page. This proves the same
 * save-driven deploy actually reaches the org from inside the Code Builder image using the
 * container's boot-authed org.
 *
 * Enables the setting, edits+saves the seeded fixture class (PagedResult.cls) with a unique comment,
 * and asserts the automatic deploy runs to completion via the progress notification and the
 * "Deployed Source" output-channel line.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  openFileFromExplorerTree,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  clearOutputChannel
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../../src/constants';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Deploy On Save (Code Builder): automatically deploys the fixture class when saved', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'deployOnSave.container.01-ready.png');
  });

  await test.step('enable deploy-on-save', async () => {
    // useMetadataExtensionCommands ensures the metadata extension's deploy-on-save service owns saves.
    // The service is created once at activation (its "Deploy on save service initialized" line is
    // emitted then — long before this spec runs on the shared persistent workbench — so it is not
    // reliably visible in the channel here). getDeployOnSaveEnabled is read per save, so enabling the
    // setting now is sufficient; the save-triggered deploy below is the authoritative signal.
    // The Settings-UI search row can transiently flake on the shared workbench; upsertSettings only
    // toggles when the current value differs, so retrying the whole call is safe and idempotent.
    await expect(async () => {
      await upsertSettings(page, {
        'salesforcedx-vscode-core.useMetadataExtensionCommands': 'true',
        [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'true'
      });
    }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
  });

  await test.step('edit + save the fixture class to trigger a deploy', async () => {
    // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling / focus),
    // so retry the open+focus as a unit before editing.
    await expect(async () => {
      await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
      const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await editor.click();
    }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
    // Re-focus the editor so the edit lands in it (a retried open may have shifted focus).
    await page.locator('[data-uri*="PagedResult.cls"]').first().click();

    // Clear the channel so the "Deployed Source" assertion reflects this save, not a prior deploy.
    await clearOutputChannel(page);
    await editOpenFile(page, `// Deploy on save container test ${Date.now()}`);
    await saveScreenshot(page, 'deployOnSave.container.02-after-edit-and-save.png');
  });

  await test.step('verify deploy triggers and completes', async () => {
    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deployOnSave.container.03-deploy-notification.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deployOnSave.container.04-deployed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
