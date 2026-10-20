/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  clearOutputChannel,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT, TEST_SETUP_TIMEOUT } from '../constants';
import { deployApexClassesFromHost, isOrgAuthedOnHost, ORG_ALIAS } from '../helpers/hostDeploy';
import {
  CMD_RUN_ALL_TESTS,
  CMD_TOGGLE_MAXIMIZED_PANEL,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  TEST_RESULTS_TAB,
  clickTreeItemAction,
  findTestExplorerItem,
  openTestExplorerAndDiscover,
  verifyNoTestRunInProgress
} from '../helpers/testExplorerHelpers';
import { waitForApexRunOutputLine } from '../helpers/waitForApexRunOutputLine';

// Shared persistent workbench: reset editor + notification state before each test.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

test('Apex Tests via Test Explorer: run all, verify discovery', async ({ page }) => {
  test.setTimeout(TEST_SETUP_TIMEOUT + TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;

  await test.step('setup org with Apex test class', async () => {
    // The container uses its boot org, already authed at startup.
    if (!isContainer) {
      await setupNonTrackingOrgAndAuth(page);
    }
    // The container's boot org is authed on the host in the Code Builder CI. Skip — never false-fail —
    // on a local run without that setup, since the host deploy can't target it.
    const orgAuthedOnHost = await isOrgAuthedOnHost();
    test.skip(!orgAuthedOnHost, `org "${ORG_ALIAS}" must be authed on the host to deploy the test class`);
    await ensureSecondarySideBarHidden(page);
    testClassName = `ExplorerTestClass${Date.now()}`;
    const testClassContent = [
      '@isTest',
      // private (no `public`): exercises private-class visibility in discovery — the load-bearing behavior gated on API version (W-23428145).
      `private class ${testClassName} {`,
      '\t@isTest',
      '\tstatic void shouldDiscoverThisTest() {',
      "\t\tSystem.assertEquals(1, 1, 'Discovery test should pass');",
      '\t}',
      '\t@isTest',
      '\tstatic void shouldAlsoDiscoverThisTest() {',
      "\t\tSystem.assertEquals(2, 2, 'Second discovery test should pass');",
      '\t}',
      '}'
    ].join('\n');
    // Create in the workspace, then deploy from the host CLI: the container's source-tracked boot org has
    // pending conflicts that block an extension deploy, and the deploy itself isn't under test here.
    await createApexClass(page, testClassName, testClassContent);
    await deployApexClassesFromHost([{ name: testClassName, content: testClassContent }]);
  });

  await test.step('open Test Explorer and refresh tests', async () => {
    const testExplorerPanel = await openTestExplorerAndDiscover(page);
    const testClassItem = testExplorerPanel
      .locator(TEST_EXPLORER_TREE_ITEM)
      .filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassItem.waitFor({ state: 'visible', timeout: 60_000 });
    await saveScreenshot(page, 'step.after-discovery-wait.png');
  });

  await test.step('run all tests from Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, CMD_RUN_ALL_TESTS);
    await saveScreenshot(page, 'step.run-all-triggered.png');
  });

  await test.step('verify test execution output in Test Results', async () => {
    const testResultsTab = page.locator(TEST_RESULTS_TAB);
    await testResultsTab.waitFor({ state: 'visible', timeout: 30_000 });
    await testResultsTab.click();
    await saveScreenshot(page, 'step.test-results-tab.png');
    await executeCommandWithCommandPalette(page, CMD_TOGGLE_MAXIMIZED_PANEL);
    await saveScreenshot(page, 'step.panel-maximized.png');
    await expect(page.getByText(testClassName).first()).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'step.results-visible.png');
    // Test Results panel renders "Pass Rate" / "Tests Ran" once the run completes.
    // (Tree items have aria-label "(Passed)" but no visible "passed" text.)
    await expect(page.getByText(/Pass Rate/i)).toBeVisible({ timeout: 60_000 });
    // Results render before the TestRun ends; the run must also end without the user touching the toast.
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.run-done.png');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForApexRunOutputLine(page, 'Ended SFDX: Run Apex Tests');
    await clearOutputChannel(page);
  });

  await test.step('verify test class appears in Test Explorer', async () => {
    const testExplorerPanel = page.locator(TEST_EXPLORER_PANEL);
    await testExplorerPanel.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step.tree-visible.png');
    const testClassItem = testExplorerPanel
      .locator(TEST_EXPLORER_TREE_ITEM)
      .filter({ hasText: new RegExp(testClassName, 'i') })
      .first();
    await expect(testClassItem).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'step.test-class-found.png');
  });

  await test.step('run all tests on a class via Test Explorer tree-item action', async () => {
    const classRow = findTestExplorerItem(page, testClassName);
    await classRow.waitFor({ state: 'visible', timeout: 30_000 });

    await clickTreeItemAction(classRow, 'Run Test');
    await saveScreenshot(page, 'step.class-run-action-clicked.png');

    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });

    // Test Results panel re-renders Pass Rate after the new run completes.
    await expect(page.getByText(/Pass Rate/i)).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
    await expect(page.getByText(testClassName).first()).toBeVisible({ timeout: TEST_RUN_TIMEOUT });

    // Explorer run path must emit the completion sentinel to the Apex Testing channel.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForApexRunOutputLine(page, 'Ended SFDX: Run Apex Tests');
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.class-run-done.png');
    await clearOutputChannel(page);
  });

  await test.step('run a single test method via Test Explorer tree-item action', async () => {
    // Expand the class row to reveal its test methods.
    const classRow = findTestExplorerItem(page, testClassName);
    const twistie = classRow.locator('.monaco-tl-twistie');
    await expect(twistie).toBeVisible({ timeout: 10_000 });
    // On the container's browser-served workbench the twistie glyph is a zero-size pseudo-element and
    // the row intercepts pointer events at its coordinates.
    await twistie.click({ force: isContainer });
    const methodRow = findTestExplorerItem(page, 'shouldDiscoverThisTest');
    await methodRow.waitFor({ state: 'visible', timeout: 15_000 });

    // Gate on the completion sentinel only. The Explorer run path (ApexTestExecutionService) writes the
    // HumanReporter detail — including the dotted "Class.method" line — to the TestRun output
    // (run.appendOutput, Test Results panel), NOT to the Apex Testing channel; only "Ended SFDX: Run Apex
    // Tests" reaches the channel. So the dotted string never appears in the channel on this path (unlike the
    // command path used by Re-Run Last Method below). Verify the specific method via its durable "Passed"
    // tree-item decoration as well as the run-completion sentinel.

    await clickTreeItemAction(methodRow, 'Run Test');
    await saveScreenshot(page, 'step.method-run-action-clicked.png');

    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForApexRunOutputLine(page, 'Ended SFDX: Run Apex Tests');
    await expect(findTestExplorerItem(page, 'shouldDiscoverThisTest')).toHaveAttribute('aria-label', /Passed/i, {
      timeout: TEST_RUN_TIMEOUT
    });
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.method-run-done.png');
    await clearOutputChannel(page);
  });

  await test.step('re-run last method populated by the sidebar single-method run', async () => {
    // The sidebar single-method run set sf:has_cached_test_method; the Re-Run Last Method command's
    // when-clause is gated on it. Confirm it surfaces, then replay it and assert the same method ran.
    await verifyCommandExists(page, packageNls.apex_test_last_method_run_text);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_last_method_run_text);
    await saveScreenshot(page, 'step.rerun-last-method.after-command.png');
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForApexRunOutputLine(page, '=== Test Summary');
    await waitForApexRunOutputLine(page, `${testClassName}.shouldDiscoverThisTest`);
    await waitForApexRunOutputLine(page, 'Ended SFDX: Run Apex Tests');
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.rerun-last-method.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
