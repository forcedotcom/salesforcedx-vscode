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
 * Container: runs against the container's boot-authed org. Because the shared persistent workbench may
 * hold other locally changed classes, assertions become relative — the output-channel wait drops the
 * exact component/file counts, and "first diff opens automatically" asserts generically that SOME
 * remote/local diff tab opened (the first component is not necessarily classNameA) rather than
 * asserting on a specific class name — the conflict tree step still asserts both created classes are
 * present, which is what this spec actually cares about.
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
  createApexClass,
  deployCurrentSourceToOrg,
  editOpenFile,
  openFileByName,
  executeExplorerContextMenuCommand,
  saveScreenshot,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  ensureSecondarySideBarHidden,
  verifyCommandExists,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { ConflictTreePage } from '../specs-conflicts/pages/conflictTreePage';
import { DiffEditorPage } from '../specs-conflicts/pages/diffEditorPage';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Source Diff (multiple files): opens first diff and populates conflict tree', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const ts = Date.now();
  const classNameA = `DiffMultiA${ts}`;
  const classNameB = `DiffMultiB${ts}`;

  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'sourceDiffMultiple.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);

      await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);

      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    }
  });

  await test.step('create and deploy first class', async () => {
    await createApexClass(page, classNameA);
    // The transient "Deploying" toast can flash past too fast to catch on a fast container deploy;
    // assert completion via the output channel there instead.
    await deployCurrentSourceToOrg(page, isContainer ? { waitViaOutputChannel: true } : undefined);
    if (!isContainer) {
      await statusBarPage.waitForCounts({ local: 0 }, DEPLOY_TIMEOUT);
    }
    await saveScreenshot(
      page,
      isContainer ? 'sourceDiffMultiple.02-classA-deployed.png' : 'diff-multi-1-classA-deployed.png'
    );
  });

  await test.step('create and deploy second class', async () => {
    await createApexClass(page, classNameB);
    await deployCurrentSourceToOrg(page, isContainer ? { waitViaOutputChannel: true } : undefined);
    if (!isContainer) {
      await statusBarPage.waitForCounts({ local: 0 }, DEPLOY_TIMEOUT);
    }
    await saveScreenshot(
      page,
      isContainer ? 'sourceDiffMultiple.03-classB-deployed.png' : 'diff-multi-2-classB-deployed.png'
    );
  });

  await test.step('edit both classes locally', async () => {
    await openFileByName(page, `${classNameA}.cls`);
    await editOpenFile(page, '// Local change A');
    await openFileByName(page, `${classNameB}.cls`);
    await editOpenFile(page, '// Local change B');
    if (!isContainer) {
      await statusBarPage.waitForCounts({ local: 2 }, 60_000);
    }
    await saveScreenshot(page, isContainer ? 'sourceDiffMultiple.04-both-edited.png' : 'diff-multi-3-both-edited.png');
  });

  const tree = new ConflictTreePage(page);
  const diff = new DiffEditorPage(page);

  await test.step('diff classes folder via explorer context menu', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeExplorerContextMenuCommand(page, /^classes$/, packageNls.diff_source_against_org_text);

    if (isContainer) {
      // Relative to the shared workbench: the folder may contain other changed classes, so wait only
      // for the generic start/completion lines rather than exact component/file counts.
      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'Diff completed for', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'sourceDiffMultiple.05-output-complete.png');
    } else {
      await waitForOutputChannelText(page, { expectedText: 'Retrieving 2 components for diff...', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'Diff completed for 4 files', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'diff-multi-4-output-complete.png');
    }
  });

  await test.step('first diff opens automatically', async () => {
    if (isContainer) {
      // Parity with the headless twin's "first diff opens automatically" assertion: the multi-file
      // diff auto-opens the first component's diff before any tree interaction. Because the shared
      // workbench may hold other locally changed classes, the first component is not necessarily
      // classNameA, so assert generically that a diff editor tab (remote ↔ local) opened on its own.
      await expect(
        page.getByRole('tab', { name: /↔/ }).first(),
        'A diff editor tab should open automatically after invoking multi-file diff'
      ).toBeVisible({ timeout: 30_000 });
      await saveScreenshot(page, 'sourceDiffMultiple.055-first-diff-auto-open.png');
    } else {
      await diff.waitForTab(classNameA);
      await saveScreenshot(page, 'diff-multi-5-first-diff-open.png');
    }
  });

  await test.step('conflict tree shows both files', async () => {
    await tree.waitForItem(`${classNameA}.cls`);
    await tree.waitForItem(`${classNameB}.cls`);
    await saveScreenshot(
      page,
      isContainer ? 'sourceDiffMultiple.06-tree-populated.png' : 'diff-multi-6-tree-populated.png'
    );
  });

  await test.step('clicking second tree item opens its diff', async () => {
    await tree.clickItem(`${classNameB}.cls`);
    await diff.waitForTab(classNameB);
    await saveScreenshot(
      page,
      isContainer ? 'sourceDiffMultiple.07-diff-open.png' : 'diff-multi-7-second-diff-open.png'
    );
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
