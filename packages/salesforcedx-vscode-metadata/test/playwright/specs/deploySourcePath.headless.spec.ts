/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the Deploy This Source entry points: reachable from the editor context menu, the explorer
 * file context menu, and the explorer folder context menu, each running a deploy to completion with
 * no error notification.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org,
 * with a uniquely-named throwaway class. Source-tracking counts are asserted relative to a baseline
 * taken at setup: the container's fixture components aren't deployed to its boot org (5 local changes
 * on a fresh org), and earlier specs on the shared, persistent workbench can add more.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  editOpenFile,
  EDITOR,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  clearOutputChannel,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses } from '../utils/containerCleanup';

/** Fail if a deploy-error notification is present. */
const assertNoDeployError = async (page: Page, screenshot?: string): Promise<void> => {
  const deployError = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
    .first();
  const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasError) {
    if (screenshot) {
      await saveScreenshot(page, screenshot);
    }
    const text = await deployError.textContent();
    throw new Error(`Deploy failed with error notification: ${text}`);
  }
};

// Container-only: throwaway classes this test created, deleted from the project and org after it (pass
// or fail) so they don't pile up on the shared workbench — see utils/containerCleanup.
const createdClasses: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
  test.afterEach(() => {
    cleanupContainerApexClasses(createdClasses.splice(0));
  });
}

test('Deploy Source Path: deploys via all entry points', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `DeploySourcePathTest${Date.now()}`;
  createdClasses.push(className);
  let statusBarPage: SourceTrackingStatusBarPage;
  // Local-change count before this spec's class exists: 0 on desktop's fresh project, non-zero on the
  // container (fixture components not yet in its boot org, plus anything earlier specs left).
  let baselineLocal: number;

  /** Clear the metadata output channel so the "Deployed Source" wait only matches the next deploy. */
  const clearMetadataOutput = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
  };

  /** Wait for the deploy's progress toast to come and go, then for its "Deployed Source" output line. */
  const waitForDeployComplete = async (stepPrefix: string): Promise<void> => {
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, `${stepPrefix}.deploy-notification-appeared.png`);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await assertNoDeployError(page);
  };

  await test.step('setup', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');
    }

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    // Disable deploy-on-save so test can control when deploys happen
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    await saveScreenshot(page, 'setup.after-disable-deploy-on-save.png');
    baselineLocal = (await statusBarPage.getCounts()).local;
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('1. Editor context menu', async () => {
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // Close any open editors to ensure clean state
    await closeAllEditors(page);
    await saveScreenshot(page, 'step1.after-close-editors.png');

    // Edit class to create new local change
    await openFileByName(page, `${className}.cls`);
    await saveScreenshot(page, 'step1.after-open-file.png');
    // Ensure the editor is focused before editing
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, 'Editor context menu test');
    await saveScreenshot(page, 'step1.after-edit.png');
    await statusBarPage.waitForCounts({ local: baselineLocal + 1 }, 60_000);
    await saveScreenshot(page, 'step1.after-local-count-1.png');

    await clearMetadataOutput();

    // Querying the output channel shifts focus; re-focus the editor before right-clicking it
    await apexEditor.click();
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);
    await saveScreenshot(page, 'step1.before-context-menu.png');

    // Right-click editor → "SFDX: Deploy This Source to Org"
    await executeEditorContextMenuCommand(page, packageNls.deploy_this_source_text, `${className}.cls`);
    await saveScreenshot(page, 'step1.after-context-menu-command.png');

    await waitForDeployComplete('step1');
    await statusBarPage.waitForCounts({ local: baselineLocal }, 60_000);
    await saveScreenshot(page, 'step1.deploy-complete.png');
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);
    await saveScreenshot(page, 'step2.after-close-editors.png');

    // Ensure status bar is ready and file is synced after step 1 deploy
    await statusBarPage.waitForVisible(10_000);
    await statusBarPage.waitForCounts({ local: baselineLocal }, 30_000);
    await saveScreenshot(page, 'step2.after-sync-confirmed.png');

    // Edit class again to create new local change
    await openFileByName(page, `${className}.cls`);
    await saveScreenshot(page, 'step2.after-open-file.png');

    // Ensure the editor is fully loaded and focused before editing
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();

    // Wait for editor content to be ready
    await page.locator(EDITOR).first().waitFor({ state: 'visible', timeout: 5000 });

    // Wait for status bar to be ready and showing synced state
    await statusBarPage.waitForVisible(5000);
    const countsBeforeEdit = await statusBarPage.getCounts();
    await saveScreenshot(
      page,
      `step2.before-edit-counts-${countsBeforeEdit.local}-${countsBeforeEdit.remote}-${countsBeforeEdit.conflicts}.png`
    );

    // Ensure editor is still focused before editing
    await apexEditor.click();
    await editOpenFile(page, 'Explorer file context menu test');
    await saveScreenshot(page, 'step2.after-edit.png');

    // Check counts after edit to debug
    const countsAfterEdit = await statusBarPage.getCounts();
    await saveScreenshot(
      page,
      `step2.after-edit-counts-${countsAfterEdit.local}-${countsAfterEdit.remote}-${countsAfterEdit.conflicts}.png`
    );

    await statusBarPage.waitForCounts({ local: baselineLocal + 1 }, 60_000);
    await clearMetadataOutput();
    await saveScreenshot(page, 'step2.before-explorer-context-menu.png');

    // Right-click file in explorer → "SFDX: Deploy This Source to Org"
    // Match .cls but not .cls-meta.xml
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${className}\\.cls(?!-meta\\.xml)`),
      packageNls.deploy_this_source_text
    );
    await saveScreenshot(page, 'step2.after-explorer-context-menu-command.png');

    // Check for deploy-related error notifications before waiting for deploying notification
    await saveScreenshot(page, 'step2.checking-notifications.png');
    await assertNoDeployError(page, 'step2.deploy-error.png');

    await waitForDeployComplete('step2');
    await statusBarPage.waitForCounts({ local: baselineLocal }, 60_000);
    await saveScreenshot(page, 'step2.deploy-complete.png');
  });

  await test.step('3. Explorer context menu (directory)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);
    await saveScreenshot(page, 'step3.after-close-editors.png');

    // Ensure status bar is ready and file is synced after step 2 deploy
    await statusBarPage.waitForVisible(10_000);
    await statusBarPage.waitForCounts({ local: baselineLocal }, 30_000);
    await saveScreenshot(page, 'step3.after-sync-confirmed.png');

    // Edit class again to create new local change
    await openFileByName(page, `${className}.cls`);
    await saveScreenshot(page, 'step3.after-open-file.png');
    // Ensure the editor is focused before editing
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, 'Explorer directory context menu test');
    await saveScreenshot(page, 'step3.after-edit.png');
    const countsAfterEdit = await statusBarPage.getCounts();
    await saveScreenshot(
      page,
      `step3.after-edit-counts-${countsAfterEdit.local}-${countsAfterEdit.remote}-${countsAfterEdit.conflicts}.png`
    );
    await statusBarPage.waitForCounts({ local: baselineLocal + 1 }, 60_000);
    await saveScreenshot(page, 'step3.after-local-count-1.png');
    await clearMetadataOutput();
    await saveScreenshot(page, 'step4.before-explorer-context-menu.png');

    // Right-click "classes" folder → "SFDX: Deploy This Source to Org"
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.deploy_this_source_text);
    await saveScreenshot(page, 'step3.after-explorer-context-menu-command.png');

    // Check for deploy-related error notifications before waiting for deploying notification
    await saveScreenshot(page, 'step3.checking-notifications.png');
    await assertNoDeployError(page, 'step3.deploy-error.png');

    await waitForDeployComplete('step3');
    // The folder deploy also pushes every other pending change under classes/ — on the container, the
    // fixture's seeded classes (not yet in its boot org) and anything earlier specs left (seen on a fresh
    // org: baseline 5, local 1 after the folder deploy, aura1 remaining) — so the count can drop below
    // the baseline.
    await expect(async () => {
      expect((await statusBarPage.getCounts()).local).toBeLessThanOrEqual(baselineLocal);
    }).toPass({ timeout: 60_000 });
    const countsAfterDeploy = await statusBarPage.getCounts();
    await saveScreenshot(
      page,
      `step3.after-deploy-counts-${countsAfterDeploy.local}-${countsAfterDeploy.remote}-${countsAfterDeploy.conflicts}.png`
    );
    await saveScreenshot(page, 'step3.deploy-complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
