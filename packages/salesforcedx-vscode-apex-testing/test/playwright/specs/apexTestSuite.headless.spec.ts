/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Create Apex Test Suite: creates a new test suite via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;
  let testSuiteName: string;

  await test.step('setup minimal org with Apex test class', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    // Create an Apex test class
    testClassName = `SuiteTestClass${Date.now()}`;
    const testClassContent = `@isTest
public class ${testClassName} {
    @isTest
    static void testSuiteMethod() {
        System.assertEquals(1, 1, 'Suite test assertion should pass');
    }
}`;
    await createApexClass(page, testClassName, testClassContent);
    await saveScreenshot(page, 'setup.apex-test-class-created.png');
  });

  await test.step('create new Apex Test Suite', async () => {
    testSuiteName = `TestSuite${Date.now()}`;

    // Execute the Create Apex Test Suite command
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_create_text);
    await saveScreenshot(page, 'step1.after-command.png');

    // Wait for quick input to appear for suite name
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');

    // Type suite name
    await page.keyboard.type(testSuiteName);
    await saveScreenshot(page, 'step1.after-type-suite-name.png');
    await page.keyboard.press('Enter');

    // Wait for test class selection prompt
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.test-class-selection-visible.png');

    // Type to filter for our test class
    await page.keyboard.type(testClassName);
    await saveScreenshot(page, 'step1.after-type-class-filter.png');

    // Find and click the checkbox for the test class
    const testClassRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassRow.waitFor({ state: 'visible', timeout: 5000 });

    // Click on the checkbox (the row itself or a checkbox within it)
    const checkbox = testClassRow.locator('[role="checkbox"], .codicon-check, input[type="checkbox"]').first();
    // If checkbox visible, click it; otherwise click the row to toggle selection
    await (await checkbox.isVisible() ? checkbox.click() : testClassRow.click());
    await saveScreenshot(page, 'step1.test-class-selected.png');

    // Confirm selection (press Enter or click OK button)
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.selection-confirmed.png');
  });

  await test.step('verify test suite creation', async () => {
    // Open output panel
    await ensureOutputPanelOpen(page);
    await saveScreenshot(page, 'step2.output-panel-open.png');

    // Verify success message in output
    await waitForOutputChannelText(page, {
      expectedText: 'Create Apex Test Suite successfully ran',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step2.suite-creation-success.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Run Apex Test Suite: executes a test suite via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;
  let testSuiteName: string;

  await test.step('setup minimal org with Apex test class and test suite', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    // Create an Apex test class
    testClassName = `RunSuiteTestClass${Date.now()}`;
    const testClassContent = `@isTest
public class ${testClassName} {
    @isTest
    static void testSuiteRunMethod() {
        System.assertEquals(3, 3, 'Run suite test assertion should pass');
    }
}`;
    await createApexClass(page, testClassName, testClassContent);
    await saveScreenshot(page, 'setup.apex-test-class-created.png');

    // Create a test suite first
    testSuiteName = `RunTestSuite${Date.now()}`;
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_create_text);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(testSuiteName);
    await page.keyboard.press('Enter');

    // Wait for test class selection and select our class
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(testClassName);

    const testClassRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassRow.waitFor({ state: 'visible', timeout: 5000 });

    const checkbox = testClassRow.locator('[role="checkbox"], .codicon-check, input[type="checkbox"]').first();
    await (await checkbox.isVisible() ? checkbox.click() : testClassRow.click());
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'setup.test-suite-created.png');

    // Wait for suite creation to complete
    await ensureOutputPanelOpen(page);
    await waitForOutputChannelText(page, {
      expectedText: 'Create Apex Test Suite successfully ran',
      timeout: 60_000
    });
  });

  await test.step('run the Apex Test Suite', async () => {
    // Execute the Run Apex Test Suite command
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_run_text);
    await saveScreenshot(page, 'step1.after-command.png');

    // Wait for quick input to appear for suite selection
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.suite-selection-visible.png');

    // Select the test suite we created
    const suiteOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testSuiteName, 'i') });
    await suiteOption.waitFor({ state: 'visible', timeout: 5000 });
    await suiteOption.click();
    await saveScreenshot(page, 'step1.suite-selected.png');
  });

  await test.step('verify test suite execution output', async () => {
    // Open output panel and select Apex Testing channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await saveScreenshot(page, 'step2.output-panel-open.png');

    // Wait for test results to appear in output
    await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: 120_000 });
    await saveScreenshot(page, 'step2.test-results-visible.png');

    // Verify the test from our suite was executed
    await waitForOutputChannelText(page, { expectedText: testClassName, timeout: 30_000 });
    await saveScreenshot(page, 'step2.test-class-in-results.png');

    // Verify success message appears
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 30_000 });
    await saveScreenshot(page, 'step2.test-execution-ended.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Add Tests to Apex Test Suite: adds additional tests to existing suite', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName1: string;
  let testClassName2: string;
  let testSuiteName: string;

  await test.step('setup minimal org with two Apex test classes', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    // Create first Apex test class
    testClassName1 = `AddSuiteTestClass1${Date.now()}`;
    const testClassContent1 = `@isTest
public class ${testClassName1} {
    @isTest
    static void testMethod1() {
        System.assertEquals(1, 1, 'First class test should pass');
    }
}`;
    await createApexClass(page, testClassName1, testClassContent1);
    await saveScreenshot(page, 'setup.first-test-class-created.png');

    // Create second Apex test class
    testClassName2 = `AddSuiteTestClass2${Date.now()}`;
    const testClassContent2 = `@isTest
public class ${testClassName2} {
    @isTest
    static void testMethod2() {
        System.assertEquals(2, 2, 'Second class test should pass');
    }
}`;
    await createApexClass(page, testClassName2, testClassContent2);
    await saveScreenshot(page, 'setup.second-test-class-created.png');

    // Create a test suite with only the first class
    testSuiteName = `AddTestsSuite${Date.now()}`;
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_create_text);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(testSuiteName);
    await page.keyboard.press('Enter');

    // Select first test class
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(testClassName1);

    const testClassRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName1, 'i') });
    await testClassRow.waitFor({ state: 'visible', timeout: 5000 });

    const checkbox = testClassRow.locator('[role="checkbox"], .codicon-check, input[type="checkbox"]').first();
    await (await checkbox.isVisible() ? checkbox.click() : testClassRow.click());
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'setup.initial-suite-created.png');

    // Wait for suite creation to complete
    await ensureOutputPanelOpen(page);
    await waitForOutputChannelText(page, {
      expectedText: 'Create Apex Test Suite successfully ran',
      timeout: 60_000
    });
  });

  await test.step('add second test class to suite', async () => {
    // Execute the Add Tests to Apex Test Suite command
    await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_add_text);
    await saveScreenshot(page, 'step1.after-command.png');

    // Wait for quick input to appear for suite selection
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.suite-selection-visible.png');

    // Select our test suite
    const suiteOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testSuiteName, 'i') });
    await suiteOption.waitFor({ state: 'visible', timeout: 5000 });
    await suiteOption.click();
    await saveScreenshot(page, 'step1.suite-selected.png');

    // Wait for test class selection to add
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.add-class-selection-visible.png');

    // Filter for second test class
    await page.keyboard.type(testClassName2);
    await saveScreenshot(page, 'step1.after-type-class-filter.png');

    // Select second test class
    const testClassRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName2, 'i') });
    await testClassRow.waitFor({ state: 'visible', timeout: 5000 });

    const checkbox = testClassRow.locator('[role="checkbox"], .codicon-check, input[type="checkbox"]').first();
    await (await checkbox.isVisible() ? checkbox.click() : testClassRow.click());
    await saveScreenshot(page, 'step1.second-class-selected.png');

    // Confirm selection
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.selection-confirmed.png');
  });

  await test.step('verify test was added to suite', async () => {
    // Open output panel
    await ensureOutputPanelOpen(page);
    await saveScreenshot(page, 'step2.output-panel-open.png');

    // Verify success message in output
    await waitForOutputChannelText(page, {
      expectedText: 'Add Tests to Apex Test Suite successfully ran',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step2.add-tests-success.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
