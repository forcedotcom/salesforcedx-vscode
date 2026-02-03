/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from '@playwright/test';

import {
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';

test.describe('Apex Tests via Test Explorer', () => {
  test('Run All Tests via Test Explorer: runs all tests from sidebar', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let testClassName: string;

    await test.step('setup minimal org with Apex test class', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      // Create an Apex test class
      testClassName = `ExplorerTestClass${Date.now()}`;
      const testClassContent = `@isTest
public class ${testClassName} {
    @isTest
    static void validateTestExplorer() {
        System.assertEquals(1, 1, 'Test Explorer assertion should pass');
    }
}`;
      await createApexClass(page, testClassName, testClassContent);
      await saveScreenshot(page, 'setup.apex-test-class-created.png');
    });

    await test.step('open Test Explorer and refresh tests', async () => {
      // Focus on the Test Explorer view
      await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
      await saveScreenshot(page, 'step1.test-explorer-focused.png');

      // Wait for the Test Explorer panel to be visible
      const testExplorerPanel = page.locator('[id="workbench.view.extension.test"]');
      await testExplorerPanel.waitFor({ state: 'visible', timeout: 10_000 });
      await saveScreenshot(page, 'step1.test-explorer-visible.png');

      // Refresh tests to discover our new test class
      await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
      await saveScreenshot(page, 'step1.tests-refreshed.png');

      // Wait for tests to load by checking for test items to appear
      await expect(async () => {
        const testItems = page.locator('[role="treeitem"]');
        await expect(testItems.first()).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 30_000 });
      await saveScreenshot(page, 'step1.after-discovery-wait.png');
    });

    await test.step('run all tests from Test Explorer', async () => {
      // Execute Run All Tests command
      await executeCommandWithCommandPalette(page, 'Test: Run All Tests');
      await saveScreenshot(page, 'step2.run-all-tests-triggered.png');
    });

    await test.step('verify test execution output', async () => {
      // Open output panel and select Apex Testing channel
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Apex Testing');
      await saveScreenshot(page, 'step3.output-panel-open.png');

      // Wait for test results to appear in output
      await waitForOutputChannelText(page, { expectedText: '=== Test Results', timeout: 120_000 });
      await saveScreenshot(page, 'step3.test-results-visible.png');

      // Verify success message appears
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests', timeout: 30_000 });
      await saveScreenshot(page, 'step3.test-execution-ended.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });

  test('Verify Test Explorer shows test items after discovery', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let testClassName: string;

    await test.step('setup minimal org with Apex test class', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      // Create an Apex test class with descriptive method names
      testClassName = `DiscoveryTestClass${Date.now()}`;
      const testClassContent = `@isTest
public class ${testClassName} {
    @isTest
    static void shouldDiscoverThisTest() {
        System.assertEquals(1, 1, 'Discovery test should pass');
    }

    @isTest
    static void shouldAlsoDiscoverThisTest() {
        System.assertEquals(2, 2, 'Second discovery test should pass');
    }
}`;
      await createApexClass(page, testClassName, testClassContent);
      await saveScreenshot(page, 'setup.apex-test-class-created.png');
    });

    await test.step('open Test Explorer and verify test discovery', async () => {
      // Focus on the Test Explorer view
      await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
      await saveScreenshot(page, 'step1.test-explorer-focused.png');

      // Wait for the Test Explorer panel to be visible
      const testExplorerPanel = page.locator('[id="workbench.view.extension.test"]');
      await testExplorerPanel.waitFor({ state: 'visible', timeout: 10_000 });
      await saveScreenshot(page, 'step1.test-explorer-visible.png');

      // Refresh tests to trigger discovery
      await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
      await saveScreenshot(page, 'step1.tests-refreshed.png');

      // Wait for test discovery to complete by checking for test items
      await expect(async () => {
        const testItems = page.locator('[role="treeitem"]');
        await expect(testItems.first()).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 60_000 });
      await saveScreenshot(page, 'step1.after-discovery-wait.png');
    });

    await test.step('verify test class appears in Test Explorer', async () => {
      // Look for the test class in the Test Explorer tree
      const testExplorerTree = page.locator('[id="workbench.view.extension.test"] .monaco-list');
      await testExplorerTree.waitFor({ state: 'visible', timeout: 10_000 });
      await saveScreenshot(page, 'step2.test-tree-visible.png');

      // Try to find our test class in the tree
      // Note: The actual structure may vary depending on VS Code version
      const testClassItem = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(testClassName, 'i') });

      // Check if the test class appears using expect.toPass for retry
      await expect(async () => {
        const isVisible = await testClassItem.isVisible();
        if (!isVisible) {
          await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
        }
        expect(isVisible, `Expected test class ${testClassName} to be visible in Test Explorer`).toBe(true);
      }).toPass({ timeout: 30_000 });

      await saveScreenshot(page, 'step2.test-class-found.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
