/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  acceptNotification,
  clearAllNotifications,
  clearOutputChannel,
  createApexClass,
  createAndDeployApexTestClass,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  openFileByName,
  replaceLineInOpenFile,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  validateNoCriticalErrors,
  verifyNoTestRunInProgress,
  waitForNotification,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { CMD_TOGGLE_MAXIMIZED_PANEL } from '../helpers/testExplorerHelpers';

// The buggy service assigns accountNumber to TickerSymbol (line 6) so the test's ticker assertion
// fails. Desktop/web use fixed class names; the container stamps a unique suffix so the shared,
// persistent workbench/org never collides across specs or retries.
const buildAccountServiceContent = (className: string): string =>
  [
    `public with sharing class ${className} {`,
    '\tpublic Account createAccount(String accountName, String accountNumber, String tickerSymbol) {',
    '\t\tAccount newAcct = new Account(',
    '\t\t\tName = accountName,',
    '\t\t\tAccountNumber = accountNumber,',
    '\t\t\tTickerSymbol = accountNumber',
    '\t\t);',
    '\t\treturn newAcct;',
    '\t}',
    '}'
  ].join('\n');

const buildAccountServiceTestContent = (className: string, testClassName: string): string =>
  [
    '@IsTest',
    `private class ${testClassName} {`,
    '\t@IsTest',
    '\tstatic void should_create_account() {',
    "\t\tString acctName = 'Salesforce';",
    "\t\tString acctNumber = 'SFDC';",
    "\t\tString tickerSymbol = 'CRM';",
    '\t\tTest.startTest();',
    `\t\t${className} service = new ${className}();`,
    '\t\tAccount newAcct = service.createAccount(acctName, acctNumber, tickerSymbol);',
    '\t\tinsert newAcct;',
    '\t\tTest.stopTest();',
    '\t\tList<Account> accts = [ SELECT Id, Name, AccountNumber, TickerSymbol FROM Account WHERE Id = :newAcct.Id ];',
    "\t\tSystem.assertEquals(1, accts.size(), 'should have found new account');",
    "\t\tSystem.assertEquals(acctName, accts[0].Name, 'incorrect name');",
    "\t\tSystem.assertEquals(acctNumber, accts[0].AccountNumber, 'incorrect account number');",
    "\t\tSystem.assertEquals(tickerSymbol, accts[0].TickerSymbol, 'incorrect ticker symbol');",
    '\t}',
    '}'
  ].join('\n');

// Notification pattern for the consolidated success notification: "[name] successfully ran"
const SUCCESS_NOTIFICATION_PATTERN = /successfully ran/;

test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  }
});

// Drives the Apex test runner via Command Palette and asserts the success notification fires
// with an "Open Report" action button. The notification is managed by NotificationModeService
// and never appears in VS Code Web, so keep this scenario desktop-only (and the container, which
// runs the desktop build in a Node host).
(isDesktop() || isContainer ? test : test.skip.bind(test))(
  'Run Apex Tests: fail then fix via deploy and redeploy',
  async ({ page }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const className = isContainer ? `FailFixService${Date.now()}` : 'AccountService';
    const testClassName = isContainer ? `${className}Test` : 'AccountServiceTest';

    const runServiceTestViaPalette = async (): Promise<void> => {
      await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
      await selectQuickInputOptionByTyping(page, testClassName);
    };

    await test.step('setup', async () => {
      if (isContainer) {
        await ensureSecondarySideBarHidden(page);
      } else {
        await setupNonTrackingOrgAndAuth(page);
        await ensureSecondarySideBarHidden(page);
      }
    });

    await test.step('deploy buggy service class', async () => {
      if (isContainer) {
        await createApexClass(page, className, buildAccountServiceContent(className));
        await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
      } else {
        await createAndDeployApexTestClass(page, className, buildAccountServiceContent(className));
      }
      await saveScreenshot(page, 'setup.account-service-deployed.png');
    });

    await test.step('deploy service test class', async () => {
      if (isContainer) {
        await createApexClass(page, testClassName, buildAccountServiceTestContent(className, testClassName));
        await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
      } else {
        await createAndDeployApexTestClass(
          page,
          testClassName,
          buildAccountServiceTestContent(className, testClassName)
        );
      }
      await saveScreenshot(page, 'setup.account-service-test-deployed.png');
    });

    await test.step('clear Apex Testing output before failing run', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await clearOutputChannel(page);
    });

    await test.step('run service test via Command Palette (expected to fail)', async () => {
      await runServiceTestViaPalette();
      await saveScreenshot(page, 'step.fail.test-started.png');
    });

    await test.step('verify failing test output', async () => {
      await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
      const successNotification = await waitForNotification(page, SUCCESS_NOTIFICATION_PATTERN, { timeout: 60_000 });
      await saveScreenshot(page, 'step.fail.report-notification.png');
      // Notification visibility is enough; do not click Open Report here so we can keep editing.
      await successNotification.waitFor({ state: 'visible', timeout: 5000 });

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
      await waitForOutputChannelText(page, {
        expectedText: 'System.AssertException: Assertion Failed:',
        timeout: TEST_RUN_TIMEOUT
      });
      await waitForOutputChannelText(page, {
        expectedText: 'incorrect ticker symbol: Expected: CRM, Actual: SFDC'
      });
      await saveScreenshot(page, 'step.fail.assert-failed.png');
      // Restore panel before continuing
      await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
      await verifyNoTestRunInProgress(page);
      // A run with failing tests still completes, so it shows the same "successfully ran" toast as a passing
      // run. Clear it so it isn't re-matched (and possibly re-clicked) when we verify the passing run's toast.
      // TODO: This should be a failure notification instead. Will fix in W-24417592.
      await clearAllNotifications(page);
    });

    await test.step('clear Salesforce Metadata channel before redeploy', async () => {
      // Clear so the wait below sees only the redeploy's output, not the previous deploys'.
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await clearOutputChannel(page);
    });

    await test.step('open the service class and fix bug on line 6', async () => {
      await openFileByName(page, `${className}.cls`);
      await replaceLineInOpenFile(page, 6, '\t\t\tTickerSymbol = tickerSymbol');
      await saveScreenshot(page, 'step.fix.line-replaced.png');
    });

    await test.step('redeploy fixed service class', async () => {
      if (isDesktop() || isContainer) {
        // Desktop and the container (no push-or-deploy-on-save) both need an explicit redeploy.
        await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
      } else {
        // Web: save-on-deploy already triggered by replaceLineInOpenFile's File: Save.
        // Wait for the deploy completion line — same signal desktop uses — instead of just the
        // class name (which would also match the prior test-class deploy line).
        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata');
        await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: TEST_RUN_TIMEOUT });
      }
      await saveScreenshot(page, 'step.fix.redeployed.png');
    });

    await test.step('clear Apex Testing output before passing run', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await clearOutputChannel(page);
    });

    await test.step('rerun service test (expected to pass)', async () => {
      await runServiceTestViaPalette();
      await saveScreenshot(page, 'step.pass.test-started.png');
    });

    await test.step('verify passing run success notification and Open Report flow', async () => {
      await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });

      // Click Open Report on the success notification toast BEFORE doing any palette/maximize ops.
      // Palette opens/closes and a maximized output panel can hide or collapse the toast,
      // after which the locator never matches. acceptNotification waits for the notification
      // internally — no separate waitForNotification call needed.
      await acceptNotification(page, SUCCESS_NOTIFICATION_PATTERN, 'Open Report', { timeout: 60_000 });
      // Confirm a markdown preview tab opened for the test-result-*.md report.
      await expect(page.getByRole('tab', { name: /test-result-[a-zA-Z0-9]+\.md/ }).first()).toBeVisible({
        timeout: 10_000
      });
      await saveScreenshot(page, 'step.pass.open-report-clicked.png');
    });

    await test.step('verify passing run output channel content', async () => {
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
        await waitForOutputChannelText(page, { expectedText: `${testClassName}.should_create_account  Pass` });
      }
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
      await verifyNoTestRunInProgress(page);
      await saveScreenshot(page, 'step.pass.results-visible.png');
      await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
