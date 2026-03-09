/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import {
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../contants';

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

  // Wait for the quick pick list to populate
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 20_000 });

  // Type test class name to filter the list
  await page.keyboard.type(testClassName);

  // Wait for the filtered test class to appear in the list
  const testClassRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
  await testClassRow.waitFor({ state: 'visible', timeout: 5000 });

  // Click the row to select it
  await testClassRow.click();

  // Press Enter to confirm selection
  await page.keyboard.press('Enter');
};

/** Select a suite from a quick pick (Run Apex Test Suite or Add Tests to Apex Test Suite). */
const selectSuiteInQuickPick = async (
  page: Page,
  testSuiteName: string,
  options?: { waitForListRowMs?: number }
): Promise<void> => {
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
  await page.keyboard.type(testSuiteName);
  const waitMs = options?.waitForListRowMs ?? 30_000;
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: waitMs });
  const suiteOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testSuiteName, 'i') });
  await suiteOption.waitFor({ state: 'visible', timeout: 10_000 });
  await suiteOption.click();
};

/** Select a test class in a quick pick (type to filter, click row to select, then Enter). */
const selectTestClassInQuickPick = async (page: Page, testClassName: string): Promise<void> => {
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 10_000 });

  // Type test class name to filter the list
  await page.keyboard.type(testClassName);

  // Wait for the filtered test class to appear in the list
  const testClassRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
  await testClassRow.waitFor({ state: 'visible', timeout: 5000 });

  // Click the row to select it
  await testClassRow.click();

  // Press Enter to confirm selection
  await page.keyboard.press('Enter');
};

test('Apex Test Suite: create, verify creation, add tests, run suite', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName1: string;
  let testClassName2: string;
  let testSuiteName: string;

  await test.step('setup minimal org with two Apex test classes', async () => {
    await setupMinimalOrgAndAuth(page);

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

  await test.step('add second test class to suite', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_add_text);
    await saveScreenshot(page, 'step.add-tests.after-command.png');
    await selectSuiteInQuickPick(page, testSuiteName, { waitForListRowMs: 10_000 });
    await saveScreenshot(page, 'step.add-tests.suite-selected.png');
    await selectTestClassInQuickPick(page, testClassName2);
    await saveScreenshot(page, 'step.add-tests.done.png');
  });

  await test.step('verify tests were added to suite', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Add Tests to Apex Test Suite',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.verify-add.png');
  });

  await test.step('run Apex Test Suite', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_run_text);
    await saveScreenshot(page, 'step.run.after-command.png');
    await selectSuiteInQuickPick(page, testSuiteName);
    await saveScreenshot(page, 'step.run.suite-selected.png');
  });

  await test.step('verify test suite execution output', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, 'View: Toggle Maximized Panel');
    await saveScreenshot(page, 'step.verify-run.output-open.png');
    await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.verify-run.results-visible.png');
    await waitForOutputChannelText(page, { expectedText: testClassName1, timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: testClassName2, timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 60_000 });
    await saveScreenshot(page, 'step.verify-run.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
