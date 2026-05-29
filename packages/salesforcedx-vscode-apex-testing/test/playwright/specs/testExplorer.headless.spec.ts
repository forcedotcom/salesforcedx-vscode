/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  createAndDeployApexTestClass,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../contants';
import {
  CMD_RUN_ALL_TESTS,
  CMD_TOGGLE_MAXIMIZED_PANEL,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  TEST_RESULTS_TAB,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

test('Apex Tests via Test Explorer: run all, verify discovery', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;

  await test.step('setup minimal org with Apex test class', async () => {
    await setupMinimalOrgAndAuth(page);
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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
