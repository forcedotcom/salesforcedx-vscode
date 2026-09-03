/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of runApexTestsCodeLens.headless.spec.ts. The web twin is desktop-only
 * because salesforcedx-vscode-apex has no browser bundle, so the Run All Tests / Run Test code
 * lenses never render in VS Code Web. The Code Builder image runs the DESKTOP build in a Node host,
 * so the Apex LSP contributes those code lenses — this spec proves the exact code-lens run + re-run
 * caching path that web mode cannot cover. It reuses the seeded ExampleClass/ExampleClassTest and
 * deploys them to the boot org (one tracking scratch org authed as default target-org).
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  clickCodeLens,
  closeAllEditors,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import { CMD_TOGGLE_MAXIMIZED_PANEL } from '../../helpers/testExplorerHelpers';

const TEST_CLASS = 'ExampleClassTest';
const TEST_METHOD = 'validateSayHello';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Run Apex Tests via code lens: Run All Tests, then Run Test (single method)', async ({ page }) => {
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
    // Leaves ExampleClassTest.cls as the active editor so its code lenses are the ones clicked below.
    await deployOpenFile('ExampleClass.cls');
    await deployOpenFile('ExampleClassTest.cls');
    await saveScreenshot(page, 'setup.code-lens-class-deployed.png');
  });

  await test.step('clear output before Run All Tests via code lens', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('click Run All Tests code lens (class-level)', async () => {
    await clickCodeLens(page, 'Run All Tests', { timeout: 180_000 });
    await saveScreenshot(page, 'step.run-all.code-lens-clicked.png');
  });

  await test.step('verify Run All Tests output', async () => {
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Outcome              Passed' });
    await waitForOutputChannelText(page, { expectedText: 'Tests Ran            1' });
    await waitForOutputChannelText(page, { expectedText: 'Pass Rate            100%' });
    await waitForOutputChannelText(page, { expectedText: `${TEST_CLASS}.${TEST_METHOD}  Pass` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-all.done.png');
    // Restore panel before next step
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
  });

  await test.step('clear output before Run Test (single method) via code lens', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('click Run Test code lens (method-level)', async () => {
    await clickCodeLens(page, 'Run Test', { timeout: 180_000 });
    await saveScreenshot(page, 'step.run-single.code-lens-clicked.png');
  });

  await test.step('verify Run Test (single method) output', async () => {
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Outcome              Passed' });
    await waitForOutputChannelText(page, { expectedText: 'Tests Ran            1' });
    await waitForOutputChannelText(page, { expectedText: 'Pass Rate            100%' });
    await waitForOutputChannelText(page, { expectedText: `${TEST_CLASS}.${TEST_METHOD}  Pass` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-single.done.png');
    // Restore panel before next step
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
  });

  // The Run All Tests / Run Test code lenses above populated the class/method re-run caches,
  // so the "Re-Run Last Run …" palette commands are now reachable. (These commands cache only
  // via the code-lens entrypoints, hence this container spec is their only happy-path home.)
  await test.step('clear output before Re-Run Last Run Apex Test Class', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('re-run last test class via command palette', async () => {
    // sf:has_cached_test_class is set via async setContext after the code-lens run; wait for the
    // when-gated command to appear before invoking it.
    await verifyCommandExists(page, packageNls.apex_test_last_class_run_text);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_last_class_run_text);
    await saveScreenshot(page, 'step.rerun-last-class.after-command.png');
  });

  await test.step('verify Re-Run Last Run Apex Test Class output', async () => {
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Outcome              Passed' });
    await waitForOutputChannelText(page, { expectedText: 'Tests Ran            1' });
    await waitForOutputChannelText(page, { expectedText: `${TEST_CLASS}.${TEST_METHOD}  Pass` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.rerun-last-class.done.png');
    // Restore panel before next step
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
  });

  await test.step('clear output before Re-Run Last Run Apex Test Method', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('re-run last test method via command palette', async () => {
    // sf:has_cached_test_method is set via async setContext after the code-lens run; wait for the
    // when-gated command to appear before invoking it.
    await verifyCommandExists(page, packageNls.apex_test_last_method_run_text);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_last_method_run_text);
    await saveScreenshot(page, 'step.rerun-last-method.after-command.png');
  });

  await test.step('verify Re-Run Last Run Apex Test Method output', async () => {
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Outcome              Passed' });
    await waitForOutputChannelText(page, { expectedText: 'Tests Ran            1' });
    await waitForOutputChannelText(page, { expectedText: `${TEST_CLASS}.${TEST_METHOD}  Pass` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.rerun-last-method.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
