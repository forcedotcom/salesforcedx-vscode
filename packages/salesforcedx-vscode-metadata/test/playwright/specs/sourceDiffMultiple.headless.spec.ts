/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
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
  isMacDesktop,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  ensureSecondarySideBarHidden,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { ConflictTreePage } from '../specs-conflicts/pages/conflictTreePage';
import { DiffEditorPage } from '../specs-conflicts/pages/diffEditorPage';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';

test('Source Diff (multiple files): opens first diff and populates conflict tree', async ({ page }) => {
  test.skip(isMacDesktop(), 'Explorer context menu not available on Mac Desktop');
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const ts = Date.now();
  const classNameA = `DiffMultiA${ts}`;
  const classNameB = `DiffMultiB${ts}`;

  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and disable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);

    await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);

    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
  });

  await test.step('create and deploy first class', async () => {
    await createApexClass(page, classNameA);
    await deployCurrentSourceToOrg(page);
    await statusBarPage.waitForCounts({ local: 0 }, DEPLOY_TIMEOUT);
    await saveScreenshot(page, 'diff-multi-1-classA-deployed.png');
  });

  await test.step('create and deploy second class', async () => {
    await createApexClass(page, classNameB);
    await deployCurrentSourceToOrg(page);
    await statusBarPage.waitForCounts({ local: 0 }, DEPLOY_TIMEOUT);
    await saveScreenshot(page, 'diff-multi-2-classB-deployed.png');
  });

  await test.step('edit both classes locally', async () => {
    await openFileByName(page, `${classNameA}.cls`);
    await editOpenFile(page, '// Local change A');
    await openFileByName(page, `${classNameB}.cls`);
    await editOpenFile(page, '// Local change B');
    await statusBarPage.waitForCounts({ local: 2 }, 60_000);
    await saveScreenshot(page, 'diff-multi-3-both-edited.png');
  });

  const tree = new ConflictTreePage(page);
  const diff = new DiffEditorPage(page);

  await test.step('diff classes folder via explorer context menu', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeExplorerContextMenuCommand(page, /^classes$/, packageNls.diff_source_against_org_text);

    await waitForOutputChannelText(page, { expectedText: 'Retrieving 2 components for diff...', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Diff completed for 4 files', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'diff-multi-4-output-complete.png');
  });

  await test.step('first diff opens automatically', async () => {
    await diff.waitForTab(classNameA);
    await saveScreenshot(page, 'diff-multi-5-first-diff-open.png');
  });

  await test.step('conflict tree shows both files', async () => {
    await tree.waitForItem(`${classNameA}.cls`);
    await tree.waitForItem(`${classNameB}.cls`);
    await saveScreenshot(page, 'diff-multi-6-tree-populated.png');
  });

  await test.step('clicking second tree item opens its diff', async () => {
    await tree.clickItem(`${classNameB}.cls`);
    await diff.waitForTab(classNameB);
    await saveScreenshot(page, 'diff-multi-7-second-diff-open.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
