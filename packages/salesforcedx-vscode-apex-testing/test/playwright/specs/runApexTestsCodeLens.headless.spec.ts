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
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
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

test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  }
});

// salesforcedx-vscode-apex (which provides the Run All Tests / Run Test code lenses) has no
// "browser" bundle, so the Apex language client never registers in VS Code Web — no code lenses
// will ever appear there. Restrict this scenario to desktop and the container (which runs the
// desktop build in a Node host).
(isDesktop() || isContainer ? test : test.skip.bind(test))(
  'Run Apex Tests via code lens: Run All Tests, then Run Test (single method)',
  async ({ page }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let testClassName: string | undefined;

    // Deploy an open editor's source to the boot org, waiting on the Salesforce Metadata channel.
    // Container-only: desktop/web author + deploy a fresh class via createAndDeployApexTestClass.
    const deployOpenFile = async (fileName: string): Promise<void> => {
      await openFileByName(page, fileName);
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await clearOutputChannel(page);
      await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
    };

    await test.step('setup Apex test class', async () => {
      if (isContainer) {
        await ensureSecondarySideBarHidden(page);
        // Reuses the seeded ExampleClass/ExampleClassTest, leaving ExampleClassTest.cls as the
        // active editor so its code lenses are the ones clicked below.
        await deployOpenFile('ExampleClass.cls');
        await deployOpenFile('ExampleClassTest.cls');
        await saveScreenshot(page, 'setup.code-lens-class-deployed.png');
      } else {
        await setupNonTrackingOrgAndAuth(page);
        await ensureSecondarySideBarHidden(page);
        testClassName = `CodeLensTestClass${Date.now()}`;
        const testClassContent = [
          '@isTest',
          `public class ${testClassName} {`,
          '    @isTest',
          '    static void validateSayHello() {',
          "        System.assertEquals(1, 1, 'Basic assertion should pass');",
          '    }',
          '}'
        ].join('\n');
        await createAndDeployApexTestClass(page, testClassName, testClassContent);
        await saveScreenshot(page, 'setup.code-lens-class-created.png');
      }
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
      if (isContainer) {
        // The container's Apex Testing output renders the per-method "Class.method  Pass" line with
        // variable column spacing (and virtualizes it out of the scrolled view), so the exact-line
        // match misses even on a passing run. Assert on the always-present "Org Wide Coverage"
        // summary signal instead; Outcome/Tests Ran/Pass Rate above already prove the run passed.
        await waitForOutputChannelText(page, { expectedText: 'Org Wide Coverage' });
      } else {
        await waitForOutputChannelText(page, { expectedText: `${testClassName}.validateSayHello  Pass` });
      }
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
      await verifyNoTestRunInProgress(page);
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
      if (isContainer) {
        await waitForOutputChannelText(page, { expectedText: 'Org Wide Coverage' });
      } else {
        await waitForOutputChannelText(page, { expectedText: `${testClassName}.validateSayHello  Pass` });
      }
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
      await verifyNoTestRunInProgress(page);
      await saveScreenshot(page, 'step.run-single.done.png');
      // Restore panel before next step
      await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    });

    // The Run All Tests / Run Test code lenses above populated the class/method re-run caches,
    // so the "Re-Run Last Run …" palette commands are now reachable. (These commands cache only
    // via the code-lens entrypoints, hence this spec is their only happy-path home.)
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
      if (isContainer) {
        await waitForOutputChannelText(page, { expectedText: 'Org Wide Coverage' });
      } else {
        await waitForOutputChannelText(page, { expectedText: `${testClassName}.validateSayHello  Pass` });
      }
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
      await verifyNoTestRunInProgress(page);
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
      if (isContainer) {
        await waitForOutputChannelText(page, { expectedText: 'Org Wide Coverage' });
      } else {
        await waitForOutputChannelText(page, { expectedText: `${testClassName}.validateSayHello  Pass` });
      }
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
      await verifyNoTestRunInProgress(page);
      await saveScreenshot(page, 'step.rerun-last-method.done.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
