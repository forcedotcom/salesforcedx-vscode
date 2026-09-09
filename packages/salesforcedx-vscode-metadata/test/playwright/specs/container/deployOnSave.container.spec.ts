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
    // push-or-deploy-on-save.enabled is the ONLY setting the deploy-on-save service reads: its save
    // stream filters on getDeployOnSaveEnabled() per save (deployOnSaveService.ts), and the metadata
    // extension registers that service unconditionally at activation. The service is created once at
    // activation — long before this spec runs on the shared persistent workbench — so its init line is
    // not reliably visible in the channel here; the save-triggered deploy below is the authoritative
    // signal. Do NOT set salesforcedx-vscode-core.useMetadataExtensionCommands here: it is a legacy
    // config key that nothing in the current build reads, AND it is not a contributed setting, so the
    // Settings UI renders no result row for it — upsertSettings' search would wait 15s for a row that
    // can never attach and fail every retry (the exact failure that regressed this spec).
    // The Settings-UI search row can transiently flake on the shared workbench; upsertSettings only
    // toggles when the current value differs, so retrying the whole call is safe and idempotent.
    await expect(async () => {
      await upsertSettings(page, {
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
