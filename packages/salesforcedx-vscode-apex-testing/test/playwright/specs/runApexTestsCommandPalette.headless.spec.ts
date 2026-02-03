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

test.describe('Run Apex Tests via Command Palette', () => {
  test('Run All Tests: executes all Apex tests via command palette', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup minimal org with Apex test class', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      // Create an Apex test class
      const testClassName = `TestClass${Date.now()}`;
      const testClassContent = `@isTest
public class ${testClassName} {
    @isTest
    static void testMethod1() {
        System.assertEquals(1, 1, 'Basic assertion should pass');
    }
}`;
      await createApexClass(page, testClassName, testClassContent);
      await saveScreenshot(page, 'setup.apex-test-class-created.png');
    });

    await test.step('execute Run Apex Tests command', async () => {
      // Execute the command
      await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
      await saveScreenshot(page, 'step1.after-command.png');

      // Wait for quick input to appear
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
      await saveScreenshot(page, 'step1.quick-input-visible.png');

      // Select "All Tests" option
      const allTestsOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: /All Tests/i });
      await allTestsOption.waitFor({ state: 'visible', timeout: 5000 });
      await allTestsOption.click();
      await saveScreenshot(page, 'step1.all-tests-selected.png');
    });

    await test.step('verify test execution output', async () => {
      // Open output panel and select Apex Testing channel
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await saveScreenshot(page, 'step2.output-panel-open.png');

      // Wait for test results to appear in output
      await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: 120_000 });
      await saveScreenshot(page, 'step2.test-results-visible.png');

      // Verify success message appears
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 30_000 });
      await saveScreenshot(page, 'step2.test-execution-ended.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });

  test('Run Single Class: executes specific test class via command palette', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let testClassName: string;

    await test.step('setup minimal org with Apex test class', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      // Create an Apex test class with unique name
      testClassName = `SingleTestClass${Date.now()}`;
      const testClassContent = `@isTest
public class ${testClassName} {
    @isTest
    static void validateMethod() {
        System.assertEquals(2, 2, 'Validation assertion should pass');
    }
}`;
      await createApexClass(page, testClassName, testClassContent);
      await saveScreenshot(page, 'setup.apex-test-class-created.png');
    });

    await test.step('execute Run Apex Tests command and select specific class', async () => {
      // Execute the command
      await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
      await saveScreenshot(page, 'step1.after-command.png');

      // Wait for quick input to appear
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
      await saveScreenshot(page, 'step1.quick-input-visible.png');

      // Type the class name to filter
      await page.keyboard.type(testClassName);
      await saveScreenshot(page, 'step1.class-name-typed.png');

      // Select the specific test class
      const testClassOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
      await testClassOption.waitFor({ state: 'visible', timeout: 5000 });
      await testClassOption.click();
      await saveScreenshot(page, 'step1.class-selected.png');
    });

    await test.step('verify single class test execution output', async () => {
      // Open output panel and select Apex Testing channel
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await saveScreenshot(page, 'step2.output-panel-open.png');

      // Wait for test results to appear in output
      await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: 120_000 });
      await saveScreenshot(page, 'step2.test-results-visible.png');

      // Verify the specific test class was executed
      await waitForOutputChannelText(page, { expectedText: testClassName, timeout: 30_000 });
      await saveScreenshot(page, 'step2.specific-class-in-results.png');

      // Verify success message appears
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 30_000 });
      await saveScreenshot(page, 'step2.test-execution-ended.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
