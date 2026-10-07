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
 * Container: edits+saves the seeded fixture class (PagedResult.cls) with a unique comment instead of
 * creating a throwaway apex class, and also sets ignoreConflictsOnPush=true — the boot org is a
 * source-TRACKING scratch org (tracking orgs always run conflict detection), and on the shared
 * persistent workbench PagedResult.cls can already have remote changes from earlier specs. Without
 * that, the save-triggered deploy can be blocked by conflict detection and never reach "Deployed
 * Source", burning the full DEPLOY_TIMEOUT on retries.
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
  openFileFromExplorerTree,
  clearOutputChannel,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED, DEPLOY_ON_SAVE_IGNORE_CONFLICTS } from '../../../src/constants';
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
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'deployOnSave.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      const statusBar = new SourceTrackingStatusBarPage(page);
      await statusBar.waitForVisible(120_000);
    }

    // Enable deploy-on-save using settings UI
    // Note: useMetadataExtensionCommands is set in desktop fixtures to ensure deploy-on-save service processes saves
    const enableDeployOnSaveContainer = async (): Promise<void> => {
      // push-or-deploy-on-save.enabled is the ONLY setting the deploy-on-save service reads: its save
      // stream filters on getDeployOnSaveEnabled() per save (deployOnSaveService.ts), and the metadata
      // extension registers that service unconditionally at activation. The service is created once at
      // activation — long before this spec runs on the shared persistent workbench — so its init line is
      // not reliably visible in the channel here; the save-triggered deploy below is the authoritative
      // signal. Also set ignoreConflictsOnPush=true: the boot org is a source-TRACKING scratch org
      // (tracking orgs always run conflict detection — it cannot be disabled via
      // detectConflictsForDeployAndRetrieve), and on the shared persistent workbench PagedResult.cls
      // already has remote changes from earlier specs. Without this, the save-triggered deploy fires
      // with ignoreConflicts:false, conflict detection blocks it ("Conflicts detected. Resolve
      // conflicts before deploying"), "Deployed Source" never appears, and each retry burns the full
      // DEPLOY_TIMEOUT (which blew the 40-min job cap). This spec verifies that a save TRIGGERS a
      // deploy that reaches the org — conflict handling is a separate concern — so ignoring conflicts is
      // the correct configuration here. The Settings-UI search row can transiently flake on the shared
      // workbench; upsertSettings only toggles when the current value differs, so retrying the whole
      // call is safe and idempotent.
      await expect(async () => {
        await upsertSettings(page, {
          [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'true',
          [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_IGNORE_CONFLICTS}`]: 'true'
        });
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
    };
    const enableDeployOnSaveDesktop = async (): Promise<void> => {
      await upsertSettings(page, {
        [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'true'
      });

      // Verify deploy-on-save service is initialized by checking output channel
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await waitForOutputChannelText(page, { expectedText: 'Deploy on save service initialized', timeout: 30_000 });
    };
    await (isContainer ? enableDeployOnSaveContainer : enableDeployOnSaveDesktop)();
  });

  await test.step('edit class and save to trigger deploy', async () => {
    const editAndSaveContainer = async (): Promise<void> => {
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit before editing.
      await expect(async () => {
        await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      // Re-focus the editor so the edit lands in it (a retried open may have shifted focus).
      await page.locator('[data-uri*="PagedResult.cls"]').first().click();

      // Select the quiet 'Salesforce Metadata' channel and clear THAT, so the "Deployed Source"
      // assertion reflects this save, not a prior deploy. clearOutputChannel clears whatever channel is
      // active and then waits (2s) for it to be completely empty — if the active channel is a
      // streaming one (Apex Language Server / Salesforce CLI keep emitting on the shared workbench),
      // that empty check can never pass and times out. The metadata channel only writes during a
      // deploy, so selecting it first means we clear a quiet channel that stays empty until the
      // save-triggered deploy runs. (An earlier metadata spec has already created this channel on the
      // shared workbench.)
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await clearOutputChannel(page);
      await editOpenFile(page, `// Deploy on save container test ${Date.now()}`);
      await saveScreenshot(page, 'deployOnSave.02-after-edit-and-save.png');
    };
    const editAndSaveDesktop = async (): Promise<void> => {
      const className = `DeployOnSaveTest${Date.now()}`;
      await createApexClass(page, className);
      await editOpenFile(page, 'Deploy on save test comment');
      await saveScreenshot(page, 'after-edit-and-save.png');
    };
    await (isContainer ? editAndSaveContainer : editAndSaveDesktop)();
  });

  await test.step('verify deploy triggers and completes', async () => {
    // Deploy should start within 5 seconds on desktop (1s service delay + deploy start); the container
    // spec allows up to 30s for the shared, contended workbench.
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, isContainer ? 30_000 : 5000);
    await saveScreenshot(
      page,
      isContainer ? 'deployOnSave.03-deploy-notification.png' : 'deploy-notification-appeared.png'
    );

    // Wait for deploy to complete (notification disappears)
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    if (!isContainer) {
      await saveScreenshot(page, 'deploy-complete.png');
    }

    // Also verify in output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, {
      expectedText: 'Deployed Source',
      timeout: isContainer ? DEPLOY_TIMEOUT : 10_000
    });
    if (isContainer) {
      await saveScreenshot(page, 'deployOnSave.04-deployed.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
