/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers retrieving a file via the explorer context menu, asserted from the "Retrieved Source" output
 * line.
 *
 * Container: retrieves the seeded fixture class (PagedResult.cls) rather than a throwaway class: it is
 * deployed to the boot org first (so it exists to retrieve) with no source edit, so the shared mounted
 * fixture is not mutated.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  openFileFromExplorerTree,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  upsertSettings,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { isContainer, sharedTest as test } from '../fixtures';

const FIXTURE_CLASS = 'PagedResult';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Retrieve Source Path: retrieves file via explorer context menu', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Container retrieves the seeded fixture class as-is; desktop/headless create+edit a throwaway class.
  let className = isContainer ? FIXTURE_CLASS : '';
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'retrieveSourcePath.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'setup.after-status-bar-visible.png');
      await saveScreenshot(page, 'setup.complete.png');
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    }
  });

  await test.step('deploy source to org', async () => {
    const deploySourceToOrgContainer = async (): Promise<void> => {
      // Path-based deploy of the unmodified seeded class: guarantees the ApexClass is present in the
      // boot org regardless of suite ordering, without editing the shared fixture on disk.
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, `${FIXTURE_CLASS}.cls`, ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);

      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      // The transient "Deploying" toast is racy on a shared org where the class may already be present;
      // assert deploy completion via the output channel instead.
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'retrieveSourcePath.02-deployed.png');
    };
    const deploySourceToOrgDesktop = async (): Promise<void> => {
      // Create apex class locally
      className = `RetrieveSourcePathTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Wait for local count to increment
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      const countsAfterCreate = await statusBarPage.getCounts();
      await saveScreenshot(
        page,
        `step1.after-create-counts-${countsAfterCreate.local}-${countsAfterCreate.remote}.png`
      );

      // Deploy class to org so it exists for retrieve
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'step1.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
      await saveScreenshot(page, 'step1.after-deploy.png');

      // Simulate remote change by making a local edit
      // This creates a scenario where the file exists remotely but differs locally
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'Remote change simulation');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'step1.after-edit.png');
    };
    await (isContainer ? deploySourceToOrgContainer : deploySourceToOrgDesktop)();
  });

  await test.step('retrieve file via explorer context menu', async () => {
    if (!isContainer) {
      const initialCounts = await statusBarPage.getCounts();
      await saveScreenshot(page, `step2.initial-counts-${initialCounts.local}-${initialCounts.remote}.png`);
    }

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);

    // Right-click the apex class file in explorer and select retrieve
    const classFilePattern = new RegExp(`${className}\\.cls$`, 'i');
    await executeExplorerContextMenuCommand(page, classFilePattern, packageNls.retrieve_this_source_text);
    if (isContainer) {
      await saveScreenshot(page, 'retrieveSourcePath.03-after-context-menu.png');
    } else {
      await saveScreenshot(page, 'step2.after-context-menu.png');
    }

    // Verify retrieve starts and completes via output channel
    // Retrieve operations may not show progress notifications consistently across platforms
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    if (!isContainer) {
      await saveScreenshot(page, 'step2.retrieve-started.png');
    }

    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    if (isContainer) {
      await saveScreenshot(page, 'retrieveSourcePath.04-retrieved.png');
    } else {
      await saveScreenshot(page, 'step2.retrieve-complete.png');

      // After retrieve, local count should decrease (file retrieved from org)
      // We verify the retrieve operation completed successfully
      await saveScreenshot(page, 'step2.final-state.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
