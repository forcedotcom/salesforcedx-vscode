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
 * The container's shared serial session may hold local changes or conflicts from a prior spec, so the
 * absolute initial counts (Dreamhouse remote changes, zero local/conflicts) are asserted on desktop only.
 * Both platforms assert the relative invariants: the local count RISES by one after creating one class,
 * and returns to 0 after the ignore-conflicts push of all local changes. The throwaway class is removed
 * (from the org too) after the test in the container.
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
  createApexClass,
  editOpenFile,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  resetContainerWorkbench,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedDreamhouseTest as test } from '../fixtures';
import { cleanupContainerApexClasses } from '../utils/containerCleanup';

// Status-bar refresh may arrive via the workspace file event (fast) or the ~60s poll (fallback).
const COUNT_REFRESH_TIMEOUT = 90_000;

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

test('Source Tracking Status Bar: tracks remote and local changes through full deploy cycle', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `StatusBarClass${Date.now()}`;
  createdClasses.push(className);
  const statusBarPage = new SourceTrackingStatusBarPage(page);

  await test.step('setup', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createDreamhouseOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }

    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'sourceTrackingStatusBar.01-ready.png');
  });

  const baseline = await test.step('verify error background iff conflicts', async () => {
    const initialCounts = await statusBarPage.getCounts();
    // The always-true invariant: the red/error background appears exactly when there are conflicts.
    const hasError = await statusBarPage.hasErrorBackground();
    expect(hasError, 'Status bar error background should be present iff there are conflicts').toBe(
      initialCounts.conflicts > 0
    );
    await saveScreenshot(page, 'sourceTrackingStatusBar.02-initial-state.png');
    return initialCounts;
  });

  // Desktop starts from a fresh project against the Dreamhouse org, so absolute values are known; the
  // container's shared session may already hold local changes or conflicts, so it skips this step.
  const verifyAbsoluteInitialCounts = (): void => {
    expect(baseline.remote, 'Remote changes should be > 0 after dreamhouse deployment').toBeGreaterThan(0);
    expect(baseline.local, 'Local changes should be 0 initially').toBe(0);
    expect(baseline.conflicts, 'Conflicts should be 0 initially').toBe(0);
  };
  await (isContainer
    ? test.step.skip('verify absolute initial counts', verifyAbsoluteInitialCounts)
    : test.step('verify absolute initial counts', verifyAbsoluteInitialCounts));

  await test.step('create new apex class', async () => {
    await createApexClass(page, className);
  });

  await test.step('verify local count increments by 1', async () => {
    await statusBarPage.waitForCounts({ local: baseline.local + 1 }, COUNT_REFRESH_TIMEOUT);
    await saveScreenshot(page, 'sourceTrackingStatusBar.03-local-incremented.png');
  });

  await test.step('edit class and verify count is unchanged', async () => {
    await editOpenFile(page, '// Source tracking status bar test');
    const afterEditCounts = await statusBarPage.getCounts();
    expect(afterEditCounts.local, 'Local count should not change after editing an existing change').toBe(
      baseline.local + 1
    );
  });

  await test.step('deploy changes and verify local count returns to 0', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    // The ignore-conflicts push keeps the deploy deterministic: the container's shared boot org can
    // already differ remotely, which would otherwise stall on the conflict-resolution prompt.
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);

    // "Deployed Source" is printed only for a deploy that reached the org. The transient "Deploying"
    // toast is racy on a fast deploy, so completion is asserted via output alone.
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await statusBarPage.waitForCounts({ local: 0 }, COUNT_REFRESH_TIMEOUT);
    await saveScreenshot(page, 'sourceTrackingStatusBar.04-local-cleared.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
