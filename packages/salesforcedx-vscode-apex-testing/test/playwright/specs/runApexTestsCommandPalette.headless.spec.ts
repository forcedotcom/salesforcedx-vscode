/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  clearOutputChannel,
  createAndDeployApexTestClass,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOption,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  verifyNoTestRunInProgress,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { CMD_TOGGLE_MAXIMIZED_PANEL } from '../helpers/testExplorerHelpers';

// Container reuses the seeded PagedResultTest + ExampleClassTest classes deployed to the boot org
// rather than authoring fresh ones (desktop/web path).
const CONTAINER_TEST_CLASS_1 = 'PagedResultTest';
const CONTAINER_TEST_CLASS_2 = 'ExampleClassTest';

test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  }
});

test('Run Apex Tests via Command Palette: run all, then run single class', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;
  let testClassName2: string;

  // Deploy an open editor's source to the boot org, waiting on the Salesforce Metadata channel.
  // Container-only: desktop/web author + deploy fresh classes via createAndDeployApexTestClass.
  const deployOpenFile = async (fileName: string): Promise<void> => {
    await openFileByName(page, fileName);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  };

  await test.step('setup two Apex test classes', async () => {
    if (isContainer) {
      await ensureSecondarySideBarHidden(page);
      testClassName = CONTAINER_TEST_CLASS_1;
      testClassName2 = CONTAINER_TEST_CLASS_2;
      // Deploy each dependency class before its test class so both compile server-side.
      await deployOpenFile('PagedResult.cls');
      await deployOpenFile('PagedResultTest.cls');
      await deployOpenFile('ExampleClass.cls');
      await deployOpenFile('ExampleClassTest.cls');
      await saveScreenshot(page, 'setup.classes-deployed.png');
    } else {
      await setupNonTrackingOrgAndAuth(page);
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
    }
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
    await selectQuickInputOptionByTyping(page, testClassName, { optionTimeout: 5000 });
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
    await waitForOutputChannelText(page, { expectedText: testClassName });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.run-single.done.png');
    if (isContainer) {
      // Restore panel before next step
      await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    }
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
    await waitForOutputChannelText(page, { expectedText: testClassName });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await verifyNoTestRunInProgress(page);
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
    await waitForOutputChannelText(page, { expectedText: testClassName });
    await waitForOutputChannelText(page, { expectedText: testClassName2 });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.run-all.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
