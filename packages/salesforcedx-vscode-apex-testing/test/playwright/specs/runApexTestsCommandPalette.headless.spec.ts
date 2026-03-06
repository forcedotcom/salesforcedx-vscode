/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
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

test('Run Apex Tests via Command Palette: run all, then run single class', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;
  let testClassName2: string;

  await test.step('setup minimal org with two Apex test classes', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    testClassName = `CommandPaletteTestClass1${Date.now()}`;
    const testClassContent = [
      '@isTest',
      `public class ${testClassName} {`,
      '    @isTest',
      '    static void testMethod1() {',
      "        System.assertEquals(1, 1, 'Basic assertion should pass');",
      '    }',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName, testClassContent);
    await saveScreenshot(page, 'setup.first-class-created.png');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    testClassName2 = `CommandPaletteTestClass2${Date.now()}`;
    const testClassContent2 = [
      '@isTest',
      `public class ${testClassName2} {`,
      '    @isTest',
      '    static void testMethod2() {',
      "        System.assertEquals(2, 2, 'Second class assertion should pass');",
      '    }',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName2, testClassContent2);
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
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(testClassName);
    await saveScreenshot(page, 'step.run-single.class-typed.png');
    const testClassOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassOption.waitFor({ state: 'visible', timeout: 5000 });
    await testClassOption.click();
    await saveScreenshot(page, 'step.run-single.class-selected.png');
  });

  await test.step('verify single-class test execution output', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, 'View: Toggle Maximized Panel');
    await saveScreenshot(page, 'step.run-single.output-open.png');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.run-single.results-visible.png');
    await waitForOutputChannelText(page, { expectedText: testClassName });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-single.done.png');
  });

  await test.step('run all Apex tests via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
    await saveScreenshot(page, 'step.run-all.after-command.png');
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    const allTestsOption = page.getByRole('option', { name: 'All Tests, Runs all tests in the current org' });
    await allTestsOption.waitFor({ state: 'visible', timeout: 5000 });
    await allTestsOption.click();
    await saveScreenshot(page, 'step.run-all.selected.png');
  });

  await test.step('verify run-all test execution output', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await executeCommandWithCommandPalette(page, 'View: Toggle Maximized Panel');
    await saveScreenshot(page, 'step.run-all.output-open.png');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.run-all.results-visible.png');
    await waitForOutputChannelText(page, { expectedText: testClassName });
    await waitForOutputChannelText(page, { expectedText: testClassName2 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-all.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
