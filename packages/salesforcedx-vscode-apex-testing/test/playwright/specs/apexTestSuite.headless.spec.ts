/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForNotification,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import {
  CMD_TOGGLE_MAXIMIZED_PANEL,
  expandApexTestSuite,
  getSuiteChildrenText,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

/** Run Create Apex Test Suite via command palette: type suite name, select one class, confirm. */
const createApexTestSuiteViaPalette = async (
  page: Page,
  testSuiteName: string,
  testClassName: string
): Promise<void> => {
  await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_create_text);
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // Type suite name and press Enter (no wait needed - input is ready)
  await page.keyboard.type(testSuiteName);
  await page.keyboard.press('Enter');

  // Wait for next prompt (select test classes)
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });

  // Multi-select (canPickMany) picker: toggle the matching row checkbox, then confirm
  await selectQuickInputOptionByTyping(page, testClassName, { optionTimeout: 5000, multiSelect: true });

  // Press Enter to confirm selection
  await page.keyboard.press('Enter');
};

/** Select a suite from a quick pick (Run Apex Test Suite or Edit Apex Test Suite). */
const selectSuiteInQuickPick = async (
  page: Page,
  testSuiteName: string,
  options?: { waitForListRowMs?: number }
): Promise<void> => {
  await selectQuickInputOptionByTyping(page, testSuiteName, {
    quickInputTimeout: 15_000,
    optionTimeout: options?.waitForListRowMs
  });
  // Confirm the pick: the synthetic DOM click that selectQuickInputOptionByTyping fires only
  // highlights the row on slower runners (ubuntu/windows) without accepting it, leaving the picker
  // open so the command never runs and the output channel stays empty until TEST_RUN_TIMEOUT.
  // Only press Enter if the picker is still on the suite prompt (input still holds the typed name);
  // if the click already accepted and advanced to a follow-up prompt, do not fire a stray Enter.
  const suiteInput = page.locator(`${QUICK_INPUT_WIDGET} input.input`);
  if ((await suiteInput.inputValue().catch(() => '')) === testSuiteName) {
    await page.keyboard.press('Enter');
  }
};

/** Select a test class in a quick pick (type to filter, click row to select, then Enter). */
const selectTestClassInQuickPick = async (page: Page, testClassName: string): Promise<void> => {
  // Multi-select (canPickMany) picker: toggle the matching row checkbox, then confirm
  await selectQuickInputOptionByTyping(page, testClassName, { optionTimeout: 5000, multiSelect: true });

  // Press Enter to confirm selection
  await page.keyboard.press('Enter');
};

test('Apex Test Suite: create, verify creation, edit tests, run suite', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName1: string;
  let testClassName2: string;
  let testSuiteName: string;

  await test.step('setup non-tracking org with two Apex test classes', async () => {
    await setupNonTrackingOrgAndAuth(page);

    testClassName1 = `SuiteTestClass1${Date.now()}`;
    const testClassContent1 = [
      '@isTest',
      `public class ${testClassName1} {`,
      '\t@isTest',
      '\tstatic void testMethod1() {',
      "\t\tSystem.assertEquals(1, 1, 'First class test should pass');",
      '\t}',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName1, testClassContent1);
    await saveScreenshot(page, 'setup.first-test-class-created.png');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    testClassName2 = `SuiteTestClass2${Date.now()}`;
    const testClassContent2 = [
      '@isTest',
      `public class ${testClassName2} {`,
      '\t@isTest',
      '\tstatic void testMethod2() {',
      "\t\tSystem.assertEquals(2, 2, 'Second class test should pass');",
      '\t}',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName2, testClassContent2);
    await saveScreenshot(page, 'setup.second-test-class-created.png');
  });

  await test.step('create Apex Test Suite with first class', async () => {
    testSuiteName = `ApexTestSuite${Date.now()}`;
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await saveScreenshot(page, 'step.create-suite.before.png');
    await createApexTestSuiteViaPalette(page, testSuiteName, testClassName1);
    await saveScreenshot(page, 'step.create-suite.done.png');
  });

  await test.step('verify suite creation', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Create Apex Test Suite',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.verify-creation.png');
  });

  await test.step('edit suite to add second test class', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_edit_text);
    await saveScreenshot(page, 'step.edit-add-tests.after-command.png');
    await selectSuiteInQuickPick(page, testSuiteName, { waitForListRowMs: 10_000 });
    await saveScreenshot(page, 'step.edit-add-tests.suite-selected.png');
    // Multi-select: first class is pre-checked, toggle second class checkbox
    await selectTestClassInQuickPick(page, testClassName2);
    await saveScreenshot(page, 'step.edit-add-tests.done.png');
  });

  await test.step('verify edit completed', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Edit Apex Test Suite',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.verify-edit-add.png');
  });

  await test.step('run Apex Test Suite', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    // Gate on command registration to avoid racing extension-command registration
    await verifyCommandExists(page, packageNls.apex_test_suite_run_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_run_text);
    await saveScreenshot(page, 'step.run.after-command.png');
    await selectSuiteInQuickPick(page, testSuiteName);
    await saveScreenshot(page, 'step.run.suite-selected.png');

    // The async org run appends nothing to the Apex Testing channel until it completes, so a
    // channel-content poll would burn the whole test budget on an empty channel while the run is
    // still healthy (times out on slower ubuntu/windows runners). Gate on the run's progress toast
    // instead: wait for it to appear (so the gone-check below can't false-pass before the run
    // started), then wait for it to clear. Mirrors the passing testExplorer tree-item run path.
    await waitForNotification(page, /SFDX: Run Apex Tests/, { timeout: 60_000 });
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.run.progress-gone.png');
  });

  await test.step('verify test suite execution output', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await saveScreenshot(page, 'step.verify-run.output-open.png');
    // Backstop timeout in case the progress toast raced ahead of the gate above; normally the run has
    // already completed so this resolves immediately against the populated channel.
    await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.verify-run.results-visible.png');
    await waitForOutputChannelText(page, { expectedText: testClassName1, timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: testClassName2, timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 60_000 });
    await saveScreenshot(page, 'step.verify-run.done.png');
  });

  await test.step('edit suite to remove second test class', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_edit_text);
    await saveScreenshot(page, 'step.edit-remove-tests.after-command.png');
    await selectSuiteInQuickPick(page, testSuiteName, { waitForListRowMs: 10_000 });
    await saveScreenshot(page, 'step.edit-remove-tests.suite-selected.png');
    // Multi-select: both classes are pre-checked, uncheck second class
    await selectTestClassInQuickPick(page, testClassName2);
    await saveScreenshot(page, 'step.edit-remove-tests.done.png');
  });

  await test.step('verify edit completed', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Edit Apex Test Suite',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.verify-edit-remove.png');
  });

  await test.step('verify removed class absent from test explorer tree', async () => {
    const panel = await openTestExplorerAndDiscover(page);
    await saveScreenshot(page, 'step.verify-remove-tree.after-discover.png');
    await expandApexTestSuite(panel, testSuiteName);
    // Suite children are lazy-loaded from the org after expand — poll until testClassName1 appears
    // AND testClassName2 is gone (both must be true; checking only presence lets the poll pass
    // while testClassName2 is still present due to eventual-consistency lag in the org).
    await expect
      .poll(
        async () => {
          const children = await getSuiteChildrenText(panel, testSuiteName);
          return {
            hasClass1: children.some(t => t.includes(testClassName1)),
            hasClass2: children.some(t => t.includes(testClassName2))
          };
        },
        { timeout: 30_000 }
      )
      .toEqual({ hasClass1: true, hasClass2: false });
    const suiteChildren = await getSuiteChildrenText(panel, testSuiteName);
    expect(suiteChildren.some(t => t.includes(testClassName2))).toBe(false);
    await saveScreenshot(page, 'step.verify-remove-tree.done.png');
  });

  await test.step('re-run suite and verify removed class does not execute', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await verifyCommandExists(page, packageNls.apex_test_suite_run_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_run_text);
    await selectSuiteInQuickPick(page, testSuiteName);
    await saveScreenshot(page, 'step.rerun-suite.suite-selected.png');

    await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: testClassName1, timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 60_000 });

    // Verify removed class does NOT appear in test results (use retry-capable assertion)
    const outputPanel = page.locator('.output-view .view-lines');
    await expect(outputPanel).not.toContainText(testClassName2, { timeout: 30_000 });
    await saveScreenshot(page, 'step.rerun-suite.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
