/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for multi-file diff. The web twin (sourceDiffMultiple.headless.spec.ts)
 * proves a folder-level diff opens the first diff and populates the conflict tree on a plain Page; this
 * proves the same multi-component retrieve+diff runs inside the Code Builder image, using the container's
 * boot-authed org.
 *
 * Creates two uniquely-named throwaway classes, deploys and edits both, then diffs the classes folder, so
 * the shared mounted fixture is untouched. Because the shared persistent workbench may hold other locally
 * changed classes, assertions are relative: the conflict tree must contain BOTH created classes and a diff
 * tab must open — no absolute component/file counts. The full retrieve/CLI path web mode cannot cover.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  deployCurrentSourceToOrg,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeExplorerContextMenuCommand,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { ConflictTreePage } from '../../specs-conflicts/pages/conflictTreePage';
import { DiffEditorPage } from '../../specs-conflicts/pages/diffEditorPage';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Source Diff multiple (Code Builder): opens a diff and populates conflict tree', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const ts = Date.now();
  const classNameA = `DiffMultiA${ts}`;
  const classNameB = `DiffMultiB${ts}`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'sourceDiffMultiple.container.01-ready.png');
  });

  await test.step('create and deploy first class', async () => {
    await createApexClass(page, classNameA);
    await deployCurrentSourceToOrg(page);
    await saveScreenshot(page, 'sourceDiffMultiple.container.02-classA-deployed.png');
  });

  await test.step('create and deploy second class', async () => {
    await createApexClass(page, classNameB);
    await deployCurrentSourceToOrg(page);
    await saveScreenshot(page, 'sourceDiffMultiple.container.03-classB-deployed.png');
  });

  await test.step('edit both classes locally', async () => {
    await openFileByName(page, `${classNameA}.cls`);
    await editOpenFile(page, '// Local change A');
    await openFileByName(page, `${classNameB}.cls`);
    await editOpenFile(page, '// Local change B');
    await saveScreenshot(page, 'sourceDiffMultiple.container.04-both-edited.png');
  });

  const tree = new ConflictTreePage(page);
  const diff = new DiffEditorPage(page);

  await test.step('diff classes folder via explorer context menu', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeExplorerContextMenuCommand(page, /^classes$/, packageNls.diff_source_against_org_text);

    // Relative to the shared workbench: the folder may contain other changed classes, so wait only for
    // the generic start/completion lines rather than exact component/file counts.
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Diff completed for', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'sourceDiffMultiple.container.05-output-complete.png');
  });

  await test.step('conflict tree shows both created classes', async () => {
    await tree.waitForItem(`${classNameA}.cls`);
    await tree.waitForItem(`${classNameB}.cls`);
    await saveScreenshot(page, 'sourceDiffMultiple.container.06-tree-populated.png');
  });

  await test.step('clicking a tree item opens its diff', async () => {
    await tree.clickItem(`${classNameB}.cls`);
    await diff.waitForTab(classNameB);
    await saveScreenshot(page, 'sourceDiffMultiple.container.07-diff-open.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
