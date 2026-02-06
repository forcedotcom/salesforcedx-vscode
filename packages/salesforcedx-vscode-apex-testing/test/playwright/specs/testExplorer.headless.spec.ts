/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from '@playwright/test';

import {
  createAndDeployApexTestClass,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';

test('Apex Tests via Test Explorer: run all, verify discovery', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;

  await test.step('setup minimal org with Apex test class', async () => {
    await setupMinimalOrgAndAuth(page);
    await executeCommandWithCommandPalette(page, 'View: Toggle Secondary Side Bar Visibility');
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
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await saveScreenshot(page, 'step.explorer-focused.png');
    const testExplorerPanel = page.locator('[id="workbench.view.extension.test"]');
    await testExplorerPanel.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step.explorer-visible.png');
    await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
    await saveScreenshot(page, 'step.tests-refreshed.png');
    const testClassItem = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassItem.waitFor({ state: 'visible', timeout: 60_000 });
    await saveScreenshot(page, 'step.after-discovery-wait.png');
  });

  await test.step('run all tests from Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Test: Run All Tests');
    await saveScreenshot(page, 'step.run-all-triggered.png');
  });

  await test.step('verify test execution output in Test Results', async () => {
    await page.waitForTimeout(5000);
    const testResultsTab = page.locator('a.action-label[aria-label="Test Results"]');
    await testResultsTab.waitFor({ state: 'visible', timeout: 30_000 });
    await testResultsTab.click();
    await saveScreenshot(page, 'step.test-results-tab.png');
    await executeCommandWithCommandPalette(page, 'View: Toggle Maximized Panel');
    await saveScreenshot(page, 'step.panel-maximized.png');
    await expect(page.getByText(testClassName).first()).toBeVisible({ timeout: 180_000 });
    await saveScreenshot(page, 'step.results-visible.png');
    await expect(page.getByText(/passed|Passed/i)).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'step.run-done.png');
  });

  await test.step('verify test class appears in Test Explorer', async () => {
    const testExplorerTree = page.locator('[id="workbench.view.extension.test"] .monaco-list');
    await testExplorerTree.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step.tree-visible.png');
    const testClassItem = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(testClassName, 'i') })
      .first();
    await expect(async () => {
      const isVisible = await testClassItem.isVisible();
      if (!isVisible) {
        await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
      }
      expect(isVisible, `Expected test class ${testClassName} to be visible in Test Explorer`).toBe(true);
    }).toPass({ timeout: 30_000 });
    await saveScreenshot(page, 'step.test-class-found.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
