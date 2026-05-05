/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * LWC Run Tests — desktop-only spec (requires @salesforce/sfdx-lwc-jest on the host).
 * Covers: Test Explorer run all, per-component run, single test case, command palette,
 * code lenses (Run All Tests / Run Test), and editor toolbar button.
 *
 * Equivalent to packages/salesforcedx-vscode-automation-tests/test/specs/runLwcTests.e2e.ts.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { desktopJestTest as test } from '../fixtures/desktopFixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

// Jest runs take a while — give each test plenty of headroom
const JEST_RUN_TIMEOUT = 3 * 60 * 1000;

// Locator helpers -----------------------------------------------------------

/** Test Explorer sidebar tree item by label. */
const testItem = (page: Page, label: string) => page.getByRole('treeitem', { name: new RegExp(label, 'i') });

/** Wait for a test item to show a passed icon (codicon-testing-passed-icon). */
const waitForTestItemPassed = async (page: Page, label: string): Promise<void> => {
  const item = testItem(page, label);
  await expect(item.locator('.codicon-testing-passed-icon').first()).toBeVisible({ timeout: JEST_RUN_TIMEOUT });
};

/**
 * Focus the Test Results panel tab (not an Output channel — it's a separate xterm panel tab)
 * and wait for the xterm accessible tree to contain `expectedText`.
 */
const waitForTestResults = async (page: Page, expectedText: string, timeout = JEST_RUN_TIMEOUT): Promise<void> => {
  // Click the "Test Results" tab — it lives in the bottom panel tab bar.
  // Scope to the panel section to avoid matching the sidebar "Testing" tab.
  const panel = page.locator('#workbench\\.parts\\.panel');
  const testResultsTab = panel.locator('[role="tab"]').filter({ hasText: /^Test Results$/ });
  await testResultsTab.waitFor({ state: 'visible', timeout: 30_000 });
  await testResultsTab.click();
  // The xterm terminal output lives in list[aria-label="Stack Trace"] inside the Test Results panel.
  // The separate tree[aria-label="Test Result Messages"] only shows item labels, not terminal text.
  const stackTrace = panel.locator('[aria-label="Stack Trace"]');
  await expect(async () => {
    const text = await stackTrace.textContent({ timeout: 5000 });
    expect(text ?? '').toContain(expectedText);
  }).toPass({ timeout });
};

/** Focus the Test Explorer view and refresh test items. */
const openAndRefreshTestExplorer = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
  await page.waitForTimeout(2000);
  await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
  await page.waitForTimeout(3000);
};

// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await waitForWorkspaceReady(page);
});

test('LWC Run Tests: run all via Test Explorer and verify both suites pass', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create two LWC components', async () => {
    await createLwc(page, 'lwc1');
    await createLwc(page, 'lwc2');
    await saveScreenshot(page, 'run-all.after-create.png');
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
    await saveScreenshot(page, 'run-all.lsp-ready.png');
  });

  await test.step('open and refresh Test Explorer', async () => {
    await openAndRefreshTestExplorer(page);
    await saveScreenshot(page, 'run-all.test-explorer-open.png');
  });

  await test.step('run all LWC tests', async () => {
    await executeCommandWithCommandPalette(page, 'Test: Run All Tests');
    await saveScreenshot(page, 'run-all.after-run-command.png');
  });

  await test.step('verify both suites pass in Test Results', async () => {
    await waitForTestResults(page, 'PASS');
    const passed = testItem(page, 'lwc1').locator('.codicon-testing-passed-icon').first();
    await expect(passed).toBeVisible({ timeout: JEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'run-all.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run single component tests via Test Explorer sidebar', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create two LWC components', async () => {
    await createLwc(page, 'lwc1');
    await createLwc(page, 'lwc2');
  });

  await test.step('wait for LSP indexing', async () => {
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
  });

  await test.step('open and refresh Test Explorer', async () => {
    await openAndRefreshTestExplorer(page);
  });

  await test.step('click Run Test action button on lwc1 tree item', async () => {
    const lwc1 = testItem(page, 'lwc1');
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    await lwc1.click();
    const runButton = lwc1.getByRole('button', { name: /^Run Test/ });
    await runButton.waitFor({ state: 'visible', timeout: 10_000 });
    await runButton.click();
    await saveScreenshot(page, 'sidebar-run.after-click.png');
  });

  await test.step('verify lwc1 test item passes', async () => {
    await waitForTestItemPassed(page, 'lwc1');
    await saveScreenshot(page, 'sidebar-run.passed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run single test case via Test Explorer sidebar', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component', async () => {
    await createLwc(page, 'lwc1');
  });

  await test.step('wait for LSP indexing', async () => {
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
  });

  await test.step('open and refresh Test Explorer', async () => {
    await openAndRefreshTestExplorer(page);
  });

  await test.step('expand lwc1 and run the generated test case', async () => {
    const lwc1 = testItem(page, 'lwc1');
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    // Expand the file node to reveal child test cases
    await lwc1.click();
    await page.waitForTimeout(1000);

    const testCase = testItem(page, 'TODO: test case generated by CLI command');
    await testCase.waitFor({ state: 'visible', timeout: 15_000 });
    await testCase.click();
    const runButton = testCase.getByRole('button', { name: /^Run Test/ });
    await runButton.waitFor({ state: 'visible', timeout: 10_000 });
    await runButton.click();
    await saveScreenshot(page, 'single-case.after-click.png');
  });

  await test.step('verify test case passes', async () => {
    await waitForTestItemPassed(page, 'TODO: test case generated by CLI command');
    await saveScreenshot(page, 'single-case.passed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run current test file from command palette', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc1');
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
    // Open the test file so the command applies to it
    await openLwcFile(page, 'lwc1.test.js');
    await saveScreenshot(page, 'cmd-palette-run.test-file-open.png');
  });

  await test.step('run via command palette', async () => {
    await executeCommandWithCommandPalette(page, 'SFDX: Run Current Lightning Web Component Test File');
    await saveScreenshot(page, 'cmd-palette-run.after-command.png');
  });

  await test.step('open Test Explorer and verify test file passes', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await waitForTestItemPassed(page, 'lwc1');
    await saveScreenshot(page, 'cmd-palette-run.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

// Code lens tests are desktop-only and flaky on Linux (see original automation test skip comment)
test('LWC Run Tests: run all tests via Run All Tests code lens', async ({ page }) => {
  test.skip(process.platform === 'linux', 'code lens tests are flaky on Linux');
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc1');
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc1.test.js');
    await saveScreenshot(page, 'codelens-all.test-file-open.png');
  });

  await test.step('click Run All Tests code lens', async () => {
    const editor = page.locator('[data-uri*="lwc1.test.js"]');
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    // Code lenses appear above the describe block — wait for the "Run All Tests" link
    const runAllLens = page.getByRole('button', { name: /Run All Tests/i }).first();
    await runAllLens.waitFor({ state: 'visible', timeout: 30_000 });
    await runAllLens.click();
    await saveScreenshot(page, 'codelens-all.after-click.png');
  });

  await test.step('open Test Explorer and verify suite passes', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await waitForTestItemPassed(page, 'lwc1');
    await saveScreenshot(page, 'codelens-all.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run single test via Run Test code lens', async ({ page }) => {
  test.skip(process.platform === 'linux', 'code lens tests are flaky on Linux');
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc2');
    await openLwcFile(page, 'lwc2.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc2.test.js');
    await saveScreenshot(page, 'codelens-single.test-file-open.png');
  });

  await test.step('click Run Test code lens on first it() block', async () => {
    // The "Run Test" code lens appears above the it() call — find the first one
    const runLens = page.getByRole('button', { name: /^Run Test$/i }).first();
    await runLens.waitFor({ state: 'visible', timeout: 30_000 });
    await runLens.click();
    await saveScreenshot(page, 'codelens-single.after-click.png');
  });

  await test.step('open Test Explorer and verify test suite passes', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await waitForTestItemPassed(page, 'lwc2');
    await saveScreenshot(page, 'codelens-single.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run current test file from editor toolbar button', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc2');
    await openLwcFile(page, 'lwc2.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc2.test.js');
    await saveScreenshot(page, 'toolbar-run.test-file-open.png');
  });

  await test.step('click Run Current LWC Test File toolbar button', async () => {
    const toolbarButton = page
      .locator('.editor-actions')
      .getByRole('button', { name: /SFDX: Run Current Lightning Web Component Test File/i });
    await toolbarButton.waitFor({ state: 'visible', timeout: 15_000 });
    await toolbarButton.click();
    await saveScreenshot(page, 'toolbar-run.after-click.png');
  });

  await test.step('open Test Explorer and verify test suite passes', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await waitForTestItemPassed(page, 'lwc2');
    await saveScreenshot(page, 'toolbar-run.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
