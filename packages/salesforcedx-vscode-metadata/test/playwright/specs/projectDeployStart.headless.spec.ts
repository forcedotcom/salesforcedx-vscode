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
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org,
 * with a uniquely named throwaway class, and uses the ignore-conflicts push variant. Specs share one
 * persistent workbench and boot org, so the push also carries other local changes (the fixture
 * components aren't deployed to the boot org) that can already differ remotely; ignoring conflicts
 * keeps the deploy deterministic rather than stalling on the conflict-resolution prompt.
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  executeCommandWithCommandPalette,
  saveScreenshot,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses } from '../utils/containerCleanup';

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

test.setTimeout(DEPLOY_TIMEOUT);
test('Project Deploy Start: deploys source to org', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `ProjectDeployTest${Date.now()}`;
  createdClasses.push(className);

  await test.step('setup', async () => {
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

    // The push commands are gated on sf:target_org_has_change_tracking; the status bar appearing means
    // the org's tracking state has been resolved.
    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'projectDeployStart.01-ready.png');
  });

  await test.step('create local change and deploy to org', async () => {
    await createApexClass(page, className);
    await saveScreenshot(page, 'projectDeployStart.02-after-create-class.png');

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    // The container uses the ignore-conflicts variant (see file header): the shared boot org can already
    // differ remotely from other specs' local changes, which would stall the plain push on the
    // conflict-resolution prompt.
    await executeCommandWithCommandPalette(
      page,
      isContainer
        ? packageNls.project_deploy_start_ignore_conflicts_default_org_text
        : packageNls.project_deploy_start_default_org_text
    );
    await saveScreenshot(page, 'projectDeployStart.03-after-command.png');

    // Verify deploy starts and completes via output channel
    // Source tracking counts may not update reliably in web mode, so use output verification
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await saveScreenshot(page, 'projectDeployStart.04-deploy-started.png');

    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'projectDeployStart.05-deployed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
