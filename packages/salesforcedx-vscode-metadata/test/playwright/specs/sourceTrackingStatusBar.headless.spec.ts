/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the source-tracking status-bar widget through a full local-change -> deploy cycle (create
 * Apex class -> local count goes up -> push -> local count back to 0), plus the "error background iff
 * conflicts > 0" invariant.
 *
 * Container: runs against the BOOT org (minimalTestOrg) with NO runtime org switch — deliberately. Why
 * no switch (and why this one IS workable where the sibling non-tracking twins are test.fixme'd): the
 * source-tracking status bar refreshes on the metadata extension's own FileChangePubSub (workspace
 * file events) and a ~60s poll — both of which the code-server container delivers fine. What it does
 * NOT react to in the container is a RUNTIME DEFAULT-ORG SWITCH: that path fires only through a
 * file-change event on the GLOBAL ~/.sf/config.json, which code-server does not deliver
 * cross-extension-host (see the test.fixme reason on nonTrackingOrgTracking{UI,Commands}Hidden). This
 * spec sidesteps that wall entirely: the boot org is source-tracking and is the default from
 * activation, so the widget reflects it without any switch, and the local-change -> deploy cycle
 * exercises exactly the workspace-file/operation refresh paths that DO work in the container.
 *
 * Shared serial session hardening: absolute initial counts are NOT asserted in the container (a prior
 * spec may have left local changes or conflicts) — the invariants asserted are relative: the local
 * count RISES by one after creating one class, and returns to 0 after an (ignore-conflicts) push of
 * all local changes.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  upsertSettings,
  createApexClass,
  editOpenFile,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { isContainer, sharedDreamhouseTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Source Tracking Status Bar: tracks remote and local changes through full deploy cycle', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const statusBarPage = await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'sourceTrackingStatusBar.01-ready.png');
    } else {
      const createResult = await createDreamhouseOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }

    // Disable deploy-on-save so test can control when deploys happen
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });

    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);

    // Wait for core commands to be available
    await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);
    if (isContainer) {
      await saveScreenshot(page, 'sourceTrackingStatusBar.02-visible.png');
    }

    return statusBar;
  });

  const baseline = await test.step('verify initial state', async () => {
    const initialCounts = await statusBarPage.getCounts();

    if (isContainer) {
      // Shared session — absolute values not assumed. The always-true invariant: the red/error
      // background appears exactly when there are conflicts.
      const hasError = await statusBarPage.hasErrorBackground();
      expect(hasError, 'Status bar error background should be present iff there are conflicts').toBe(
        initialCounts.conflicts > 0
      );
    } else {
      expect(initialCounts.remote, 'Remote changes should be > 0 after dreamhouse deployment').toBeGreaterThan(0);
      expect(initialCounts.local, 'Local changes should be 0 initially').toBe(0);
      expect(initialCounts.conflicts, 'Conflicts should be 0 initially').toBe(0);

      const hasError = await statusBarPage.hasErrorBackground();
      expect(hasError, 'Status bar should not have error background when conflicts = 0').toBe(false);
    }

    return initialCounts;
  });

  await test.step('create new apex class', async () => {
    const className = isContainer ? `StatusBarClass${Date.now()}` : `TestClass${Date.now()}`;
    await createApexClass(page, className);
  });

  await test.step('verify local count increments to 1', async () => {
    // Refresh may arrive via the workspace file event (fast) or the ~60s poll (fallback), so the
    // container allows a more generous window; only the LOCAL delta is asserted there, so a nonzero
    // baseline is fine.
    await statusBarPage.waitForCounts({ local: baseline.local + 1 }, isContainer ? 90_000 : 60_000);
    if (isContainer) {
      await saveScreenshot(page, 'sourceTrackingStatusBar.03-local-incremented.png');
    }
  });

  await test.step('edit class and verify count stays at 1', async () => {
    await editOpenFile(page, isContainer ? '// Source tracking status bar container test' : 'Modified for testing');
    const afterEditCounts = await statusBarPage.getCounts();
    expect(afterEditCounts.local, 'Local count should stay at 1 after editing existing change').toBe(
      baseline.local + 1
    );
  });

  await test.step('deploy changes and verify local count returns to 0', async () => {
    // Shared boot org can already differ remotely, so the container uses the ignore-conflicts push to
    // stay deterministic (matches the projectDeployStart container twin).
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    await statusBarPage.waitForCounts({ local: 0 }, isContainer ? 90_000 : 60_000);
    if (isContainer) {
      await saveScreenshot(page, 'sourceTrackingStatusBar.04-local-cleared.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
