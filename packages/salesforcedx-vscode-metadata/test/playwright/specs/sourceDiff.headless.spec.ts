/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers diff-source-against-org reachable from the command palette and the explorer context menu.
 * Creates a uniquely-named throwaway class, deploys it, edits it locally, then diffs it against the
 * org, asserted from the "Diff completed for 1 file" output line and the diff editor tab.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org.
 * The throwaway class is removed (from the org too) after the test, and the local counts are asserted
 * relative to their starting value since the shared workbench may already hold other local changes.
 */

import { expect, type Page } from '@playwright/test';
import {
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  openFileByName,
  outputChannelContains,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses } from '../utils/containerCleanup';

const verifyDiffCompleted = async (page: Page, className: string, screenshot: string) => {
  // Wait for retrieving message
  await waitForOutputChannelText(page, { expectedText: 'Retrieving 1 component for diff...', timeout: 30_000 });

  // Verify retrieve succeeded
  expect(
    await outputChannelContains(page, '0 components retrieved', { timeout: 100 }),
    'Should not show "0 components retrieved"'
  ).toBe(false);

  expect(
    await outputChannelContains(page, 'No components retrieved from org', { timeout: 100 }),
    'Should not show "No components retrieved from org"'
  ).toBe(false);

  expect(
    await outputChannelContains(page, 'No matching files found to diff', { timeout: 100 }),
    'Should not show "No matching files found to diff"'
  ).toBe(false);

  // Wait for diff completion
  await waitForOutputChannelText(page, { expectedText: 'Diff completed for 1 file', timeout: 60_000 });

  // Verify diff tab exists
  const diffTabTitle = `remote//${className}.cls ↔ local//${className}.cls`;
  const diffTab = page.getByRole('tab', {
    name: new RegExp(diffTabTitle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  });
  await expect(diffTab, `Diff tab with title "${diffTabTitle}" should exist`).toBeVisible({ timeout: 10_000 });
  await saveScreenshot(page, screenshot);
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

test('Source Diff: diff shows diff editor', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `SourceDiffTest${Date.now()}`;
  createdClasses.push(className);
  const statusBarPage = new SourceTrackingStatusBarPage(page);
  let initialLocalCount: number;

  // Start each operation from an empty Salesforce Metadata channel so its output waits can only match
  // that operation, not an earlier step's.
  const clearMetadataOutput = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
  };

  /** Edit the deployed class so it differs from the org, and wait for tracking to see the local change. */
  const makeLocalChange = async (text: string): Promise<void> => {
    await closeAllEditors(page);
    await openFileByName(page, `${className}.cls`);

    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();

    await editOpenFile(page, text);
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
  };

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

    await statusBarPage.waitForVisible(120_000);
    initialLocalCount = (await statusBarPage.getCounts()).local;
    await saveScreenshot(page, 'sourceDiff.01-ready.png');
  });

  await test.step('create and deploy class', async () => {
    await createApexClass(page, className);
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);

    await clearMetadataOutput();
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

    // "Deployed Source" is printed only for a deploy that reached the org. The transient "Deploying"
    // toast is racy on a fast deploy, so completion is asserted via output alone.
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    // The command can finish writing output before source tracking has applied the deploy result.
    // Editing sooner lets that late update reset the new local change, which is most visible on
    // slower Windows runners.
    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
    await saveScreenshot(page, 'sourceDiff.02-deployed.png');
  });

  await test.step('create local change and diff via command palette', async () => {
    await makeLocalChange('// Local change for diff test');
    await clearMetadataOutput();

    await executeCommandWithCommandPalette(page, packageNls.diff_source_against_org_text);

    await verifyDiffCompleted(page, className, 'sourceDiff.03-palette-diff.png');
  });

  await test.step('create local change and diff via explorer context menu', async () => {
    await makeLocalChange('// Explorer context menu diff test');
    await clearMetadataOutput();

    // Right-click file in explorer - match .cls but not .cls-meta.xml
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${className}\\.cls(?!-meta\\.xml)`),
      packageNls.diff_source_against_org_text
    );

    await verifyDiffCompleted(page, className, 'sourceDiff.04-explorer-diff.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
