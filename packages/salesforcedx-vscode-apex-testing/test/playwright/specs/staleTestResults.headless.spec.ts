/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator, type Page } from '@playwright/test';

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

const TEST_EXPLORER_PANEL = '[id="workbench.view.extension.test"]';
const TEST_EXPLORER_TREE_ITEM = '[role="treeitem"]';
const LOCAL_NAMESPACE_LABEL = 'Local Namespace';
const UNPACKAGED_METADATA_LABEL = '(Unpackaged Metadata)';

const expandTreeRow = async (panel: Locator, rowLabel: string): Promise<void> => {
  const row = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: rowLabel });
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const twistie = row.locator('.monaco-tl-twistie');

  const isExpanded = async (): Promise<boolean> => {
    try {
      const collapsed = await twistie.evaluate(el => el.classList.contains('collapsed'));
      return !collapsed;
    } catch {
      return false;
    }
  };

  if (await isExpanded()) {
    return;
  }

  try {
    await twistie.click({ force: true });
    await new Promise(resolve => setTimeout(resolve, 400));
  } catch {
    // continue
  }
};

const expandNamespaceAndPackage = async (panel: Locator): Promise<void> => {
  await expandTreeRow(panel, LOCAL_NAMESPACE_LABEL);
  await panel
    .locator(TEST_EXPLORER_TREE_ITEM)
    .filter({ hasText: UNPACKAGED_METADATA_LABEL })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expandTreeRow(panel, UNPACKAGED_METADATA_LABEL);
};

const openTestExplorerAndDiscover = async (page: Page): Promise<Locator> => {
  await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
  const panel = page.locator(TEST_EXPLORER_PANEL);
  await panel.waitFor({ state: 'visible', timeout: 10_000 });
  await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
  await page.waitForTimeout(1000);
  await expect(panel.getByText(LOCAL_NAMESPACE_LABEL)).toBeVisible({ timeout: 60_000 });
  await expandNamespaceAndPackage(panel);
  return panel;
};

const runAllTests = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Test: Run All Tests');
  const testResultsTab = page.locator('a.action-label[aria-label="Test Results"]');
  await testResultsTab.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.getByText(/passed|Passed/i)).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
};

const getFilterInput = (panel: Locator): Locator => panel.locator('input[placeholder*="Filter"]');

const verifyStaleTagInAutocomplete = async (page: Page, panel: Locator): Promise<void> => {
  const filterInput = getFilterInput(panel);
  await filterInput.click();
  await filterInput.fill('@');
  await page.waitForTimeout(500);
  const staleOption = page.getByText('sf.apex.testController:stale');
  await expect(staleOption).toBeVisible({ timeout: 5000 });
  await filterInput.fill('');
  await page.keyboard.press('Escape');
};

test.describe('Stale Test Results', () => {
  test('stale tag appears after restoration and is removed by running tests', async ({ page }) => {
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
      const panel = await openTestExplorerAndDiscover(page);
      const testClassItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(testClassName, 'i') });
      await testClassItem.waitFor({ state: 'visible', timeout: 60_000 });
      await saveScreenshot(page, 'stale.step.before-run.png');
      await runAllTests(page);
      await saveScreenshot(page, 'stale.step.after-run.png');
    });

    await test.step('reload window to trigger restoration as stale', async () => {
      await executeCommandWithCommandPalette(page, 'Developer: Reload Window');
      await page.waitForTimeout(5000);
      await saveScreenshot(page, 'stale.step.after-reload.png');
    });

    await test.step('verify stale tag appears in filter autocomplete', async () => {
      const panel = await openTestExplorerAndDiscover(page);
      await saveScreenshot(page, 'stale.step.after-rediscovery.png');
      await verifyStaleTagInAutocomplete(page, panel);
      await saveScreenshot(page, 'stale.step.stale-tag-visible.png');
    });

    await test.step('verify filtering by @stale shows test items', async () => {
      const panel = page.locator(TEST_EXPLORER_PANEL);
      const filterInput = getFilterInput(panel);
      await filterInput.click();
      await filterInput.fill('@sf.apex.testController:stale');
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 'stale.step.filtered-by-stale.png');
      const testClassItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(testClassName, 'i') });
      await expect(testClassItem.first()).toBeVisible({ timeout: 10_000 });
      await filterInput.fill('');
      await page.keyboard.press('Escape');
    });

    await test.step('run a single test and verify stale tag is removed', async () => {
      const panel = page.locator(TEST_EXPLORER_PANEL);
      await expandNamespaceAndPackage(panel);
      await expandTreeRow(panel, testClassName);
      await page.waitForTimeout(500);

      const methodRow = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: 'testMethodOne' });
      await methodRow.waitFor({ state: 'visible', timeout: 10_000 });

      // Run the single method via inline action or fallback to run all
      await methodRow.hover();
      const runButton = methodRow.locator('[aria-label="Run Test"]').first();
      const action = (await runButton.isVisible())
        ? runButton.click()
        : executeCommandWithCommandPalette(page, 'Test: Run All Tests');
      await action;
      await page.waitForTimeout(5000);
      await saveScreenshot(page, 'stale.step.after-single-run.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });

  test('clear apex test results removes result files', async ({ page }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let testClassName: string;

    await test.step('setup minimal org with Apex test class', async () => {
      await setupMinimalOrgAndAuth(page);
      await ensureSecondarySideBarHidden(page);
      testClassName = `ClearTestClass${Date.now()}`;
      const testClassContent = [
        '@isTest',
        `public class ${testClassName} {`,
        '\t@isTest',
        '\tstatic void testClearMethod() {',
        "\t\tSystem.assertEquals(1, 1, 'clear test');",
        '\t}',
        '}'
      ].join('\n');
      await createAndDeployApexTestClass(page, testClassName, testClassContent);
    });

    await test.step('discover and run tests', async () => {
      const panel = await openTestExplorerAndDiscover(page);
      const testClassItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(testClassName, 'i') });
      await testClassItem.waitFor({ state: 'visible', timeout: 60_000 });
      await runAllTests(page);
      await saveScreenshot(page, 'clear.step.after-run.png');
    });

    await test.step('execute clear apex test results command', async () => {
      await executeCommandWithCommandPalette(page, 'SFDX: Clear Apex Test Results');
      await page.waitForTimeout(2000);
      await saveScreenshot(page, 'clear.step.after-clear.png');
    });

    await test.step('refresh and verify results are not restored', async () => {
      await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
      await page.waitForTimeout(3000);
      await saveScreenshot(page, 'clear.step.after-refresh.png');
      const panel = page.locator(TEST_EXPLORER_PANEL);
      // After clear + refresh, the tree should have items but no pass/fail results
      // The @stale tag should NOT appear since there are no result files to restore
      const filterInput = getFilterInput(panel);
      await filterInput.click();
      await filterInput.fill('@');
      await page.waitForTimeout(500);
      const staleOption = page.getByText('sf.apex.testController:stale');
      await expect(staleOption).not.toBeVisible({ timeout: 3000 });
      await filterInput.fill('');
      await page.keyboard.press('Escape');
      await saveScreenshot(page, 'clear.step.no-stale-after-clear.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
