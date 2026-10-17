/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers Push Source to Default Org: the command runs and reports success via the "Starting metadata
 * deployment" and "Deployed Source" output-channel lines.
 *
 * Container: deploy-on-save is disabled first so an edit+save creates a persistent local change
 * (rather than being auto-deployed before the push), and edits the seeded fixture class
 * (PagedResult.cls) with a unique comment instead of creating a throwaway apex class. It also uses the
 * ignore-conflicts push variant: specs share one persistent workbench and boot org, so the class can
 * already differ remotely (source-tracking conflict), and ignoring conflicts keeps the deploy
 * deterministic rather than stalling on the conflict-resolution prompt.
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
  executeCommandWithCommandPalette,
  verifyCommandExists,
  saveScreenshot,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  ensureSecondarySideBarHidden,
  editOpenFile,
  openFileFromExplorerTree,
  resetContainerWorkbench,
  upsertSettings
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test.setTimeout(DEPLOY_TIMEOUT);
test('Project Deploy Start: deploys source to org', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let statusBarPage: SourceTrackingStatusBarPage;
  let className: string;

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'projectDeployStart.01-ready.png');

      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
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

      // Wait for core commands to be available
      await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);

      await saveScreenshot(page, 'setup.complete.png');
    }
  });

  await test.step('create local change and deploy to org', async () => {
    const createLocalChangeContainer = async (): Promise<void> => {
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit before editing.
      await expect(async () => {
        await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      await editOpenFile(page, `// Project deploy start container test ${Date.now()}`);
      await saveScreenshot(page, 'projectDeployStart.02-after-edit.png');
    };
    const createLocalChangeDesktop = async (): Promise<void> => {
      // Create a new Apex class to deploy
      className = `ProjectDeployTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Get initial counts
      const initialCounts = await statusBarPage.getCounts();
      await saveScreenshot(
        page,
        `step1.initial-counts-${initialCounts.local}-${initialCounts.remote}-${initialCounts.conflicts}.png`
      );
    };
    await (isContainer ? createLocalChangeContainer : createLocalChangeDesktop)();

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);

    // Execute deploy via command palette. The container uses the ignore-conflicts variant: specs share
    // one persistent workbench and boot org, so the class can already differ remotely (source-tracking
    // conflict); ignoring conflicts keeps the deploy deterministic rather than stalling on the
    // conflict-resolution prompt.
    await executeCommandWithCommandPalette(
      page,
      isContainer
        ? packageNls.project_deploy_start_ignore_conflicts_default_org_text
        : packageNls.project_deploy_start_default_org_text
    );
    await saveScreenshot(
      page,
      isContainer ? 'projectDeployStart.03-after-command.png' : 'step1.after-command-palette.png'
    );

    // Verify deploy starts and completes via output channel
    // Source tracking counts may not update reliably in web mode, so use output verification
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await saveScreenshot(page, isContainer ? 'projectDeployStart.04-deploy-started.png' : 'step1.deploy-started.png');

    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, isContainer ? 'projectDeployStart.05-deployed.png' : 'step1.deploy-complete.png');

    if (!isContainer) {
      // Deploy operation completed successfully (verified via output channel)
      await saveScreenshot(page, 'step1.final-state.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
