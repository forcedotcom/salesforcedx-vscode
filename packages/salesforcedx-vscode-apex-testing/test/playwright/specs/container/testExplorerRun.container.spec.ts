/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the two coverages the twin (testExplorer.headless.spec.ts) has that no
 * container spec re-covered (report A3):
 *   1. Running a test via the native Test Explorer tree-item "Run Test" action (twin lines 110-162).
 *      The run*.container specs cover the command palette and code-lens entrypoints only.
 *   2. Verifying the native Test Results panel "Pass Rate" summary after the run (twin lines 94, 126).
 *      The run*.container specs assert the "Pass Rate 100%" line in the Apex Testing OUTPUT channel,
 *      never the native Test Results panel surface.
 *
 * The web twin is desktop-only because salesforcedx-vscode-apex has no browser bundle, so the Test
 * Controller never surfaces in VS Code Web. The Code Builder image runs the DESKTOP build in a Node
 * host, so the Apex LSP contributes the class/method nodes to the Test Controller and their inline
 * Run actions drive a real org run. This spec reuses the seeded ExampleClass/ExampleClassTest and
 * deploys them to the boot org (one tracking scratch org authed as default target-org) rather than
 * authoring new classes, keeping the shared org state bounded.
 *
 * The sibling testExplorer.container.spec.ts keeps the discovery-only coverage intact.
 */

import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import {
  TEST_RESULTS_TAB,
  clickTreeItemAction,
  findTestExplorerItem,
  openTestExplorerAndDiscover
} from '../../helpers/testExplorerHelpers';

const DEPENDENCY_CLASS = 'ExampleClass';
const TEST_CLASS = 'ExampleClassTest';
const TEST_METHOD = 'validateSayHello';

// Self-clean before each test so the shared, persistent workbench starts from a known state.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Apex Test Explorer (Code Builder): run via tree-item action + verify Test Results Pass Rate', async ({
  page
}) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Deploy an open editor's source to the boot org, waiting on the Salesforce Metadata channel.
  const deployOpenFile = async (fileName: string): Promise<void> => {
    await openFileByName(page, fileName);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  };

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('deploy seeded ExampleClass + ExampleClassTest to the boot org', async () => {
    // Deploy the dependency class first so the test class compiles server-side, then the test class.
    await deployOpenFile(`${DEPENDENCY_CLASS}.cls`);
    await deployOpenFile(`${TEST_CLASS}.cls`);
    await saveScreenshot(page, 'testExplorerRun.container.setup.classes-deployed.png');
  });

  await test.step('open Test Explorer and discover the seeded test class', async () => {
    await openTestExplorerAndDiscover(page);
    await expect(findTestExplorerItem(page, TEST_CLASS)).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'testExplorerRun.container.01-discovered.png');
  });

  await test.step('run the class via the Test Explorer tree-item "Run Test" action', async () => {
    // Clear the Apex Testing channel first so the completion sentinel below can't match a prior run.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);

    const classRow = findTestExplorerItem(page, TEST_CLASS);
    await classRow.waitFor({ state: 'visible', timeout: 30_000 });
    await clickTreeItemAction(classRow, 'Run Test');
    await saveScreenshot(page, 'testExplorerRun.container.02-run-action-clicked.png');

    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    // The Explorer run path (ApexTestExecutionService) emits the completion sentinel to the channel.
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'testExplorerRun.container.03-run-done.png');
  });

  await test.step('verify the native Test Results panel "Pass Rate" summary', async () => {
    // Target the Test Results tab in the bottom panel; the panel renders "Pass Rate" once a run completes.
    const testResultsTab = page.locator(TEST_RESULTS_TAB);
    await testResultsTab.waitFor({ state: 'visible', timeout: 30_000 });
    await testResultsTab.click();
    await expect(page.getByText(/Pass Rate/i)).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'testExplorerRun.container.04-pass-rate.png');
  });

  await test.step('verify the passed decoration on the test-method tree item', async () => {
    // Expand the class to reveal its method; the leaf carries the durable "(Passed)" aria-label.
    const classRow = findTestExplorerItem(page, TEST_CLASS);
    await classRow.locator('.monaco-tl-twistie').click({ force: true });
    const methodRow = findTestExplorerItem(page, TEST_METHOD);
    await methodRow.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(methodRow).toHaveAttribute('aria-label', /Passed/i, { timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'testExplorerRun.container.05-passed-decoration.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
