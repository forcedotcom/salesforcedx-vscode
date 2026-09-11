/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of sourceTrackingStatusBar.headless.
 *
 * The web twin creates a Dreamhouse scratch org, makes it the default, and drives the source-tracking
 * status-bar widget through a full local-change → deploy cycle (create Apex class → local count goes up →
 * push → local count back to 0). This container twin runs against the BOOT org (minimalTestOrg) with NO
 * runtime org switch — deliberately.
 *
 * Why no switch (and why this one IS workable where the sibling non-tracking twins are test.fixme'd): the
 * source-tracking status bar refreshes on the metadata extension's own FileChangePubSub (workspace file
 * events) and a ~60s poll — both of which the code-server container delivers fine. What it does NOT react
 * to in the container is a RUNTIME DEFAULT-ORG SWITCH: that path fires only through a file-change event on
 * the GLOBAL ~/.sf/config.json, which code-server does not deliver cross-extension-host (see the
 * test.fixme reason on nonTrackingOrgTracking{UI,Commands}Hidden.container). This spec sidesteps that wall
 * entirely: the boot org is source-tracking and is the default from activation, so the widget reflects it
 * without any switch, and the local-change → deploy cycle exercises exactly the workspace-file/operation
 * refresh paths that DO work in the container.
 *
 * Shared serial session hardening: absolute initial counts are NOT asserted (a prior spec may have left
 * local changes or conflicts). Instead the invariants asserted are relative — the local count RISES by one
 * after creating one class, and returns to 0 after an (ignore-conflicts) push of all local changes — plus
 * the always-true "error background iff conflicts > 0" check.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  editOpenFile,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertSettings,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../../src/constants';

// Shared persistent workbench: reset editor + notification state before each test rather than assuming a
// clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Source Tracking Status Bar (Code Builder): reflects local changes through a deploy cycle on the boot org', async ({
  page
}) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'sourceTrackingStatusBar.container.01-ready.png');
  });

  await test.step('disable deploy-on-save so the created class stays a local change', async () => {
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
  });

  const statusBar = new SourceTrackingStatusBarPage(page);

  await test.step('status bar is visible against the boot (source-tracking) org', async () => {
    // The boot org tracks source and is default from activation, so the widget shows its counts without
    // any org switch — the whole point of running this twin against the boot org.
    await statusBar.waitForVisible(120_000);
    await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);
    await saveScreenshot(page, 'sourceTrackingStatusBar.container.02-visible.png');
  });

  const baseline = await test.step('read baseline counts (shared session — absolute values not assumed)', async () => {
    const counts = await statusBar.getCounts();
    // Invariant that holds regardless of what prior specs left behind: the red/error background appears
    // exactly when there are conflicts.
    const hasError = await statusBar.hasErrorBackground();
    expect(hasError, 'Status bar error background should be present iff there are conflicts').toBe(
      counts.conflicts > 0
    );
    return counts;
  });

  await test.step('create a new apex class and verify the local count rises by one', async () => {
    const className = `StatusBarClass${Date.now()}`;
    await createApexClass(page, className);
    // Refresh may arrive via the workspace file event (fast) or the ~60s poll (fallback), so allow a
    // generous window; only the LOCAL delta is asserted, so a nonzero baseline is fine.
    await statusBar.waitForCounts({ local: baseline.local + 1 }, 90_000);
    await saveScreenshot(page, 'sourceTrackingStatusBar.container.03-local-incremented.png');
  });

  await test.step('edit the open class and verify the local count stays the same', async () => {
    await editOpenFile(page, '// Source tracking status bar container test');
    const afterEdit = await statusBar.getCounts();
    expect(afterEdit.local, 'Editing an already-changed component must not add another local change').toBe(
      baseline.local + 1
    );
  });

  await test.step('push all local changes and verify the local count returns to 0', async () => {
    // Shared boot org can already differ remotely, so use the ignore-conflicts push to stay deterministic
    // (matches the projectDeployStart container twin).
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    await statusBar.waitForCounts({ local: 0 }, 90_000);
    await saveScreenshot(page, 'sourceTrackingStatusBar.container.04-local-cleared.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
