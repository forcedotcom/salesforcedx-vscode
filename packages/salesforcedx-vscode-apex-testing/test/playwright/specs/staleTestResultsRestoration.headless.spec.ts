/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  WORKBENCH,
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
  CMD_RELOAD_WINDOW,
  CMD_RUN_ALL_TESTS,
  STALE_AUTOCOMPLETE_OPTION,
  STALE_FILTER_TAG,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  clearFilter,
  expandNamespaceAndPackage,
  expandTreeRow,
  focusAndTypeInFilter,
  openTestExplorerAndDiscover,
  runAllTestsAndWaitForCompletion
} from '../helpers/testExplorerHelpers';

test('Stale tag appears after restoration and is removed by running tests', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;

  await test.step('setup minimal org with Apex test class', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    testClassName = `StaleTestClass${Date.now()}`;
    const testClassContent = [
      '@isTest',
      `public class ${testClassName} {`,
      '\t@isTest',
      '\tstatic void testMethodOne() {',
      "\t\tSystem.assertEquals(1, 1, 'test one');",
      '\t}',
      '\t@isTest',
      '\tstatic void testMethodTwo() {',
      "\t\tSystem.assertEquals(2, 2, 'test two');",
      '\t}',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName, testClassContent);
  });

  await test.step('discover and run tests to generate result files', async () => {
    await openTestExplorerAndDiscover(page);
    await saveScreenshot(page, 'stale.step.before-run.png');
    await runAllTestsAndWaitForCompletion(page, TEST_RUN_TIMEOUT);
    await saveScreenshot(page, 'stale.step.after-run.png');
  });

  await test.step('reload window to trigger restoration as stale', async () => {
    await executeCommandWithCommandPalette(page, CMD_RELOAD_WINDOW);
    // After reload the workbench is rebuilt; wait for it to come back before continuing.
    await page.locator(WORKBENCH).waitFor({ state: 'visible', timeout: 30_000 });
    await saveScreenshot(page, 'stale.step.after-reload.png');
  });

  await test.step('verify stale tag appears in filter autocomplete', async () => {
    await openTestExplorerAndDiscover(page);
    await saveScreenshot(page, 'stale.step.after-rediscovery.png');
    await focusAndTypeInFilter(page, '@');
    const staleOption = page.getByText(STALE_AUTOCOMPLETE_OPTION);
    await expect(staleOption).toBeVisible({ timeout: 5000 });
    await clearFilter(page);
    await saveScreenshot(page, 'stale.step.stale-tag-visible.png');
  });

  await test.step('verify filtering by @stale shows test items', async () => {
    const panel = page.locator(TEST_EXPLORER_PANEL);
    await focusAndTypeInFilter(page, STALE_FILTER_TAG);
    await saveScreenshot(page, 'stale.step.filtered-by-stale.png');
    const testClassItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(testClassName, 'i') });
    await expect(testClassItem.first()).toBeVisible({ timeout: 10_000 });
    await clearFilter(page);
  });

  await test.step('run a single test and verify stale tag is removed', async () => {
    const panel = page.locator(TEST_EXPLORER_PANEL);
    await expandNamespaceAndPackage(panel);
    await expandTreeRow(panel, testClassName);

    const methodRow = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: 'testMethodOne' });
    await methodRow.waitFor({ state: 'visible', timeout: 10_000 });

    // Run the single method via inline action or fallback to run all
    await methodRow.hover();
    const runButton = methodRow.locator('[aria-label="Run Test"]').first();
    const action = (await runButton.isVisible())
      ? runButton.click()
      : executeCommandWithCommandPalette(page, CMD_RUN_ALL_TESTS);
    await action;
    // Wait for run completion (Test Results panel populates Pass Rate stats).
    await expect(page.getByText(/Pass Rate/i)).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
    // After running, the @stale tag should be removed from autocomplete suggestions.
    await focusAndTypeInFilter(page, '@');
    await expect(page.getByText(STALE_AUTOCOMPLETE_OPTION)).not.toBeVisible({ timeout: 10_000 });
    await clearFilter(page);
    await saveScreenshot(page, 'stale.step.after-single-run.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
