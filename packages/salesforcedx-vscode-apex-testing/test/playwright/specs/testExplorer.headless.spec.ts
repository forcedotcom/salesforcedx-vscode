/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator } from '@playwright/test';

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

// Selectors for Test Explorer UI elements
const TEST_EXPLORER_PANEL = '[id="workbench.view.extension.test"]';
const TEST_EXPLORER_TREE_ITEM = '[role="treeitem"]';
const TEST_RESULTS_TAB = 'a.action-label[aria-label="Test Results"]';
// Labels for namespace/package grouping (must match apex-testing nls)
const LOCAL_NAMESPACE_LABEL = 'Local Namespace';
const UNPACKAGED_METADATA_LABEL = '(Unpackaged Metadata)';

/**
 * Expands a tree row. Uses twisty click (force) then click left edge of row; one of these works for Test Explorer nodes.
 */
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

/** Expands Local Namespace then (Unpackaged Metadata), waiting for each child to appear before expanding the next. */
const expandNamespaceAndPackage = async (panel: Locator): Promise<void> => {
  await expandTreeRow(panel, LOCAL_NAMESPACE_LABEL);
  await panel
    .locator(TEST_EXPLORER_TREE_ITEM)
    .filter({ hasText: UNPACKAGED_METADATA_LABEL })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expandTreeRow(panel, UNPACKAGED_METADATA_LABEL);
};

test('Apex Tests via Test Explorer: run all, verify discovery', async ({ page }) => {
  test.setTimeout(180_000);
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
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await saveScreenshot(page, 'step.explorer-focused.png');
    const testExplorerPanel = page.locator(TEST_EXPLORER_PANEL);
    await testExplorerPanel.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step.explorer-visible.png');
    await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
    await saveScreenshot(page, 'step.tests-refreshed.png');
    // Wait for discovery to populate the tree (top-level "Local Namespace" node)
    await expect(testExplorerPanel.getByText(LOCAL_NAMESPACE_LABEL)).toBeVisible({ timeout: 60_000 });
    // Expand namespace then package so test class is visible (grouping: Namespace → Package → Class → Method)
    await expandNamespaceAndPackage(testExplorerPanel);
    const testClassItem = testExplorerPanel
      .locator(TEST_EXPLORER_TREE_ITEM)
      .filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassItem.waitFor({ state: 'visible', timeout: 60_000 });
    await saveScreenshot(page, 'step.after-discovery-wait.png');
  });

  await test.step('run all tests from Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Test: Run All Tests');
    await saveScreenshot(page, 'step.run-all-triggered.png');
  });

  await test.step('verify test execution output in Test Results', async () => {
    const testResultsTab = page.locator(TEST_RESULTS_TAB);
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
