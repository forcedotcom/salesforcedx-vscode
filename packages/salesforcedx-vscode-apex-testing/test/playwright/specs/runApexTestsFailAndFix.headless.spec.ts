/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  acceptNotification,
  clearOutputChannel,
  createAndDeployApexTestClass,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  openFileByName,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  replaceLineInOpenFile,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForNotification,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../contants';
import { CMD_TOGGLE_MAXIMIZED_PANEL } from '../helpers/testExplorerHelpers';

const ACCOUNT_SERVICE_CONTENT = [
  'public with sharing class AccountService {',
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

const ACCOUNT_SERVICE_TEST_CONTENT = [
  '@IsTest',
  'private class AccountServiceTest {',
  '\t@IsTest',
  '\tstatic void should_create_account() {',
  "\t\tString acctName = 'Salesforce';",
  "\t\tString acctNumber = 'SFDC';",
  "\t\tString tickerSymbol = 'CRM';",
  '\t\tTest.startTest();',
  '\t\tAccountService service = new AccountService();',
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

const REPORT_NOTIFICATION_PATTERN = /Apex test report is ready: test-result-[a-zA-Z0-9]+\.md/;

const runAccountServiceTestViaPalette = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type('AccountServiceTest');
  const option = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: /AccountServiceTest/i });
  await option.first().waitFor({ state: 'visible', timeout: 10_000 });
  await option.first().click();
};

// Drives the Apex test runner via Command Palette and asserts the
// "Apex test report is ready: …" notification fires. The report-ready notification ships from
// salesforcedx-vscode-apex (no "browser" bundle), so it never appears in VS Code Web — keep
// this scenario desktop-only until a web bundle exists for that extension.
(isDesktop() ? test : test.skip.bind(test))(
  'Run Apex Tests: fail then fix via deploy and redeploy',
  async ({ page }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup non-tracking org', async () => {
      await setupNonTrackingOrgAndAuth(page);
      await ensureSecondarySideBarHidden(page);
    });

    await test.step('deploy buggy AccountService class', async () => {
      await createAndDeployApexTestClass(page, 'AccountService', ACCOUNT_SERVICE_CONTENT);
      await saveScreenshot(page, 'setup.account-service-deployed.png');
    });

    await test.step('deploy AccountServiceTest class', async () => {
      await createAndDeployApexTestClass(page, 'AccountServiceTest', ACCOUNT_SERVICE_TEST_CONTENT);
      await saveScreenshot(page, 'setup.account-service-test-deployed.png');
    });

    await test.step('clear Apex Testing output before failing run', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await clearOutputChannel(page);
    });

    await test.step('run AccountServiceTest via Command Palette (expected to fail)', async () => {
      await runAccountServiceTestViaPalette(page);
      await saveScreenshot(page, 'step.fail.test-started.png');
    });

    await test.step('verify failing test output', async () => {
      await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
      const reportNotification = await waitForNotification(page, REPORT_NOTIFICATION_PATTERN, { timeout: 60_000 });
      await saveScreenshot(page, 'step.fail.report-notification.png');
      // Notification visibility is enough; do not click Open Report here so we can keep editing.
      await reportNotification.waitFor({ state: 'visible', timeout: 5000 });

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
      // Clear all notifications so the failing run's "Apex test report is ready" toast doesn't
      // get re-matched (and possibly re-clicked) when we verify the passing-run notification.
      await executeCommandWithCommandPalette(page, 'Notifications: Clear All Notifications');
    });

    await test.step('clear Salesforce Metadata channel before redeploy', async () => {
      // Clear so the wait below sees only the redeploy's output, not the previous deploys'.
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await clearOutputChannel(page);
    });

    await test.step('open AccountService.cls and fix bug on line 6', async () => {
      await openFileByName(page, 'AccountService.cls');
      await replaceLineInOpenFile(page, 6, '\t\t\tTickerSymbol = tickerSymbol');
      await saveScreenshot(page, 'step.fix.line-replaced.png');
    });

    await test.step('redeploy fixed AccountService.cls', async () => {
      if (isDesktop()) {
        await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
      } else {
        // Web: save-on-deploy already triggered by replaceLineInOpenFile's File: Save.
        // Wait for the deploy completion line — same signal desktop uses — instead of just the
        // class name (which would also match the prior AccountServiceTest deploy line).
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

    await test.step('rerun AccountServiceTest (expected to pass)', async () => {
      await runAccountServiceTestViaPalette(page);
      await saveScreenshot(page, 'step.pass.test-started.png');
    });

    await test.step('verify passing run report notification and Open Report flow', async () => {
      await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });

      // Click Open Report on the report-ready toast BEFORE doing any palette/maximize ops.
      // Palette opens/closes and a maximized output panel can hide or collapse the toast,
      // after which the locator never matches. acceptNotification waits for the notification
      // internally — no separate waitForNotification call needed.
      await acceptNotification(page, REPORT_NOTIFICATION_PATTERN, 'Open Report', { timeout: 60_000 });
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
      await waitForOutputChannelText(page, { expectedText: 'AccountServiceTest.should_create_account  Pass' });
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
      await saveScreenshot(page, 'step.pass.results-visible.png');
      await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
