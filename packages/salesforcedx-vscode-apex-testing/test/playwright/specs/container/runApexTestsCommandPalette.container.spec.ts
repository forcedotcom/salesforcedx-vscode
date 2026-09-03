/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of runApexTestsCommandPalette.headless.spec.ts. The web twin never
 * surfaces Apex test runs because salesforcedx-vscode-apex has no browser bundle. The Code Builder
 * image runs the DESKTOP build in a Node host, so the SFDX: Run Apex Tests command palette flow
 * (run single class, re-run last class, run all) works end-to-end against the boot org (one tracking
 * scratch org authed as default target-org). It reuses the seeded PagedResultTest + ExampleClassTest
 * classes instead of authoring new ones.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOption,
  selectQuickInputOptionByTyping,
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

const TEST_CLASS_1 = 'PagedResultTest';
const TEST_CLASS_2 = 'ExampleClassTest';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Run Apex Tests via Command Palette: run all, then run single class', async ({ page }) => {
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

  await test.step('deploy seeded Apex classes to the boot org', async () => {
    await ensureSecondarySideBarHidden(page);
    // Deploy each dependency class before its test class so both compile server-side.
    await deployOpenFile('PagedResult.cls');
    await deployOpenFile('PagedResultTest.cls');
    await deployOpenFile('ExampleClass.cls');
    await deployOpenFile('ExampleClassTest.cls');
    await saveScreenshot(page, 'setup.classes-deployed.png');
  });

  await test.step('clear output before run-single', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await saveScreenshot(page, 'step.output-cleared.png');
  });

  await test.step('run single test class via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
    await saveScreenshot(page, 'step.run-single.after-command.png');
    await selectQuickInputOptionByTyping(page, TEST_CLASS_1, { optionTimeout: 5000 });
    await saveScreenshot(page, 'step.run-single.class-selected.png');
  });

  await test.step('verify single-class test execution output', async () => {
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await saveScreenshot(page, 'step.run-single.output-open.png');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.run-single.results-visible.png');
    await waitForOutputChannelText(page, { expectedText: TEST_CLASS_1 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-single.done.png');
    // Restore panel before next step
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
  });

  await test.step('re-run last class populated by the single-class palette run', async () => {
    // Single-class palette run set sf:has_cached_test_class; the Re-Run Last Class command's when-clause is gated on it.
    await verifyCommandExists(page, packageNls.apex_test_last_class_run_text);
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_last_class_run_text);
    await saveScreenshot(page, 'step.rerun-last-class.after-command.png');
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: TEST_CLASS_1 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.rerun-last-class.done.png');
  });

  await test.step('clear output before running all tests', async () => {
    await clearOutputChannel(page);
  });

  await test.step('run all Apex tests via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
    await saveScreenshot(page, 'step.run-all.after-command.png');
    await selectQuickInputOption(page, 'All Tests, Runs all tests in the current org', {
      quickInputVisibleTimeout: 10_000,
      optionVisibleTimeout: 5000
    });
    await saveScreenshot(page, 'step.run-all.selected.png');
  });

  await test.step('verify run-all test execution output', async () => {
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await saveScreenshot(page, 'step.run-all.output-open.png');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.run-all.results-visible.png');
    await waitForOutputChannelText(page, { expectedText: TEST_CLASS_1 });
    await waitForOutputChannelText(page, { expectedText: TEST_CLASS_2 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-all.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
