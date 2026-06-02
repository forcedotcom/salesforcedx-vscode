/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  clearOutputChannel,
  clickCodeLens,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../contants';
import { CMD_TOGGLE_MAXIMIZED_PANEL } from '../helpers/testExplorerHelpers';

test('Run Apex Tests via code lens: Run All Tests, then Run Test (single method)', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const testClassName = `CodeLensTestClass${Date.now()}`;
  const testClassContent = [
    '@isTest',
    `public class ${testClassName} {`,
    '    @isTest',
    '    static void validateSayHello() {',
    "        System.assertEquals(1, 1, 'Basic assertion should pass');",
    '    }',
    '}'
  ].join('\n');

  await test.step('setup minimal org with one Apex test class', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await createAndDeployApexTestClass(page, testClassName, testClassContent);
    await saveScreenshot(page, 'setup.code-lens-class-created.png');
  });

  await test.step('clear output before Run All Tests via code lens', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('click Run All Tests code lens (class-level)', async () => {
    await clickCodeLens(page, 'Run All Tests');
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
    await waitForOutputChannelText(page, { expectedText: `${testClassName}.validateSayHello  Pass` });
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
    await clickCodeLens(page, 'Run Test');
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
    await waitForOutputChannelText(page, { expectedText: `${testClassName}.validateSayHello  Pass` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.run-single.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
