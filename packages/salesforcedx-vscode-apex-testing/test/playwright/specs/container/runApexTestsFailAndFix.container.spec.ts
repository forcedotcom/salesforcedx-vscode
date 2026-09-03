/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of runApexTestsFailAndFix.headless.spec.ts. The web twin is desktop-only
 * because the consolidated "successfully ran" success notification (with its Open Report action) is
 * managed by NotificationModeService and never appears in VS Code Web. The Code Builder image runs
 * the DESKTOP build in a Node host, so that notification + Open Report markdown-preview flow works —
 * this spec proves the fail-then-fix runner path web mode cannot cover. Fail-then-fix inherently
 * needs a class that fails then is corrected, so it authors uniquely-named classes (rather than
 * reusing the always-passing seeded classes) and deploys them to the boot org (one tracking scratch
 * org authed as default target-org).
 */

import { expect, type Page } from '@playwright/test';
import {
  acceptNotification,
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  createApexClass,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  replaceLineInOpenFile,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForNotification,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import { CMD_TOGGLE_MAXIMIZED_PANEL } from '../../helpers/testExplorerHelpers';

// Unique per run so the shared, persistent workbench/org never collides across specs or retries.
const CLASS_NAME = `FailFixService${Date.now()}`;
const TEST_CLASS_NAME = `${CLASS_NAME}Test`;

// The buggy service assigns accountNumber to TickerSymbol (line 6) so the test's ticker assertion fails.
const SERVICE_CONTENT = [
  `public with sharing class ${CLASS_NAME} {`,
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

const SERVICE_TEST_CONTENT = [
  '@IsTest',
  `private class ${TEST_CLASS_NAME} {`,
  '\t@IsTest',
  '\tstatic void should_create_account() {',
  "\t\tString acctName = 'Salesforce';",
  "\t\tString acctNumber = 'SFDC';",
  "\t\tString tickerSymbol = 'CRM';",
  '\t\tTest.startTest();',
  `\t\t${CLASS_NAME} service = new ${CLASS_NAME}();`,
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

const runServiceTestViaPalette = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'SFDX: Run Apex Tests');
  await selectQuickInputOptionByTyping(page, TEST_CLASS_NAME);
};

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Run Apex Tests: fail then fix via deploy and redeploy', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('deploy buggy service class', async () => {
    await createApexClass(page, CLASS_NAME, SERVICE_CONTENT);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
    await saveScreenshot(page, 'setup.service-deployed.png');
  });

  await test.step('deploy service test class', async () => {
    await createApexClass(page, TEST_CLASS_NAME, SERVICE_TEST_CONTENT);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
    await saveScreenshot(page, 'setup.service-test-deployed.png');
  });

  await test.step('clear Apex Testing output before failing run', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('run service test via Command Palette (expected to fail)', async () => {
    await runServiceTestViaPalette(page);
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
    // Clear all notifications so the failing run's success notification doesn't
    // get re-matched (and possibly re-clicked) when we verify the passing-run notification.
    await clearAllNotifications(page);
  });

  await test.step('clear Salesforce Metadata channel before redeploy', async () => {
    // Clear so the wait below sees only the redeploy's output, not the previous deploys'.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
  });

  await test.step('open the service class and fix bug on line 6', async () => {
    await openFileByName(page, `${CLASS_NAME}.cls`);
    await replaceLineInOpenFile(page, 6, '\t\t\tTickerSymbol = tickerSymbol');
    await saveScreenshot(page, 'step.fix.line-replaced.png');
  });

  await test.step('redeploy fixed service class', async () => {
    // The container runs the desktop build with no push-or-deploy-on-save, so deploy explicitly.
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
    await saveScreenshot(page, 'step.fix.redeployed.png');
  });

  await test.step('clear Apex Testing output before passing run', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  });

  await test.step('rerun service test (expected to pass)', async () => {
    await runServiceTestViaPalette(page);
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
    await waitForOutputChannelText(page, { expectedText: `${TEST_CLASS_NAME}.should_create_account  Pass` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.pass.results-visible.png');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
