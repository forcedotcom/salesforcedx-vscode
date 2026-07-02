/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import {
  CMD_RUN_ALL_TESTS,
  CMD_TOGGLE_MAXIMIZED_PANEL,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  TEST_RESULTS_TAB,
  clickTreeItemAction,
  findTestExplorerItem,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

test('Apex Tests via Test Explorer: run all, verify discovery', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;

  await test.step('setup non-tracking org with Apex test class', async () => {
    await setupNonTrackingOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    testClassName = `ExplorerTestClass${Date.now()}`;
    const testClassContent = [
      '@isTest',
      `public class ${testClassName} {`,
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
    await createAndDeployApexTestClass(page, testClassName, testClassContent);
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
    await saveScreenshot(page, 'step.run-done.png');
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
    await saveScreenshot(page, 'step.class-run-done.png');
  });

  await test.step('run a single test method via Test Explorer tree-item action', async () => {
    // Expand the class row to reveal its test methods.
    const classRow = findTestExplorerItem(page, testClassName);
    await classRow.locator('.monaco-tl-twistie').click({ force: true });
    const methodRow = findTestExplorerItem(page, 'shouldDiscoverThisTest');
    await methodRow.waitFor({ state: 'visible', timeout: 15_000 });
    await clickTreeItemAction(methodRow, 'Run Test');
    await saveScreenshot(page, 'step.method-run-action-clicked.png');

    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await expect(page.getByText(/Pass Rate/i)).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
    await expect(page.getByText(`${testClassName}.shouldDiscoverThisTest`).first()).toBeVisible({
      timeout: TEST_RUN_TIMEOUT
    });
    await saveScreenshot(page, 'step.method-run-done.png');
  });

  await test.step('re-run last method populated by the sidebar single-method run', async () => {
    // The sidebar single-method run set sf:has_cached_test_method; the Re-Run Last Method command's
    // when-clause is gated on it. Confirm it surfaces, then replay it and assert the same method ran.
    await verifyCommandExists(page, packageNls.apex_test_last_method_run_text);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.apex_test_last_method_run_text);
    await saveScreenshot(page, 'step.rerun-last-method.after-command.png');
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: `${testClassName}.shouldDiscoverThisTest` });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.rerun-last-method.done.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
