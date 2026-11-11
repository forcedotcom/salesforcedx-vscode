/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers a folder-level (multi-file) diff: it opens the first diff automatically and populates the
 * conflict tree. Creates two uniquely-named throwaway classes, deploys and edits both, then diffs the
 * classes folder.
 *
 * Container: runs against the container's boot-authed org. The shared persistent workbench's classes
 * folder also holds the seeded fixture classes and possibly other local changes, so the folder-diff
 * output wait drops the exact component/file counts, and "first diff opens automatically" asserts that
 * SOME remote/local diff tab opened (the first component sorted by name is not necessarily classNameA).
 * The conflict-tree steps still assert both created classes are present, which is what this spec
 * actually cares about. Local counts are asserted relative to their starting value, and both classes
 * are removed (from the org too) after the test.
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
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
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
import { ConflictTreePage } from '../specs-conflicts/pages/conflictTreePage';
import { DiffEditorPage } from '../specs-conflicts/pages/diffEditorPage';
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

test('Source Diff (multiple files): opens first diff and populates conflict tree', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const ts = Date.now();
  const classNameA = `DiffMultiA${ts}`;
  const classNameB = `DiffMultiB${ts}`;
  createdClasses.push(classNameA, classNameB);

  const statusBarPage = new SourceTrackingStatusBarPage(page);
  let initialLocalCount: number;

  // Start each operation from an empty Salesforce Metadata channel so its output waits can only match
  // that operation — otherwise class B's deploy wait matches class A's earlier "Deployed Source" line
  // even when B's deploy fails.
  const clearMetadataOutput = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
  };

  /** Create a class and deploy it, waiting until source tracking no longer counts it as a local change. */
  const createAndDeployClass = async (className: string): Promise<void> => {
    await createApexClass(page, className);
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);

    await clearMetadataOutput();
    // Re-open the class so "Deploy This Source" targets it, not whichever editor clearing output left active.
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

    // "Deployed Source" is printed only for a deploy that reached the org. The transient "Deploying"
    // toast is racy on a fast deploy, so completion is asserted via output alone.
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
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
    await saveScreenshot(page, 'sourceDiffMultiple.01-ready.png');
  });

  await test.step('create and deploy first class', async () => {
    await createAndDeployClass(classNameA);
    await saveScreenshot(page, 'sourceDiffMultiple.02-classA-deployed.png');
  });

  await test.step('create and deploy second class', async () => {
    await createAndDeployClass(classNameB);
    await saveScreenshot(page, 'sourceDiffMultiple.03-classB-deployed.png');
  });

  await test.step('edit both classes locally', async () => {
    await openFileByName(page, `${classNameA}.cls`);
    await editOpenFile(page, '// Local change A');
    await openFileByName(page, `${classNameB}.cls`);
    await editOpenFile(page, '// Local change B');
    await statusBarPage.waitForCounts({ local: initialLocalCount + 2 }, 60_000);
    await saveScreenshot(page, 'sourceDiffMultiple.04-both-edited.png');
  });

  const tree = new ConflictTreePage(page);
  const diff = new DiffEditorPage(page);

  await test.step('diff classes folder via explorer context menu', async () => {
    await clearMetadataOutput();

    await executeExplorerContextMenuCommand(page, /^classes$/, packageNls.diff_source_against_org_text);

    // Desktop's classes folder holds only the two created classes, so the exact counts are known. The
    // container's also holds the seeded fixture classes and any other local changes, so it waits only
    // for the generic start/completion lines.
    await waitForOutputChannelText(page, {
      expectedText: isContainer ? 'Retrieving' : 'Retrieving 2 components for diff...',
      timeout: 30_000
    });
    await waitForOutputChannelText(page, {
      expectedText: isContainer ? 'Diff completed for' : 'Diff completed for 4 files',
      timeout: DEPLOY_TIMEOUT
    });
    await saveScreenshot(page, 'sourceDiffMultiple.05-output-complete.png');
  });

  await test.step('first diff opens automatically', async () => {
    // The multi-file diff auto-opens the first changed file by name before any tree interaction. On
    // desktop that is classNameA; on the container another changed class can sort first, so it asserts
    // that a remote ↔ local diff tab opened on its own.
    const firstDiffTab = page.getByRole('tab', { name: isContainer ? /↔/ : new RegExp(`${classNameA}.*↔`) }).first();
    await expect(firstDiffTab, 'The first diff editor tab should open automatically').toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'sourceDiffMultiple.06-first-diff-auto-open.png');
  });

  await test.step('conflict tree shows both files', async () => {
    await tree.waitForItem(`${classNameA}.cls`);
    await tree.waitForItem(`${classNameB}.cls`);
    await saveScreenshot(page, 'sourceDiffMultiple.07-tree-populated.png');
  });

  await test.step('clicking second tree item opens its diff', async () => {
    await tree.clickItem(`${classNameB}.cls`);
    await diff.waitForTab(classNameB);
    await saveScreenshot(page, 'sourceDiffMultiple.08-second-diff-open.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
