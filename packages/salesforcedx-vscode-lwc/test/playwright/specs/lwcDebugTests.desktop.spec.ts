/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * LWC Debug Tests — desktop-only spec (requires @salesforce/sfdx-lwc-jest on the host).
 * Covers: Test Explorer debug all, single test case debug, command palette, and editor toolbar button.
 * Code lens debug tests are omitted (flaky in original automation test).
 *
 * Equivalent to packages/salesforcedx-vscode-automation-tests/test/specs/debugLwcTests.e2e.ts.
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

// Jest debug runs take a while — give each test plenty of headroom
const JEST_RUN_TIMEOUT = 3 * 60 * 1000;

// Locator helpers -----------------------------------------------------------

/** Test Explorer sidebar tree item by label. */
const testItem = (page: Page, label: string) => page.getByRole('treeitem', { name: new RegExp(label, 'i') });

/** Focus the Test Explorer view and refresh test items. */
const openAndRefreshTestExplorer = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
  await page.waitForTimeout(2000);
  await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
  await page.waitForTimeout(3000);
};

/**
 * Focus the Test Explorer and wait for a test item's passed icon.
 * Does NOT call "Test: Refresh Tests" — refreshing resets run-result state on Windows/Linux.
 */
const focusTestExplorerAndWaitForPassed = async (page: Page, label: string): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
  await page.waitForTimeout(3000);
  const item = testItem(page, label);
  await expect(item.locator('.codicon-testing-passed-icon').first()).toBeVisible({
    timeout: JEST_RUN_TIMEOUT
  });
};

/**
 * Wait for the debug toolbar to appear then click Continue until the session ends.
 * Jest runs with --inspect-brk so it always pauses before any code executes;
 * clicking Continue repeatedly lets tests run to completion.
 */
const continueDebuggingUntilDone = async (page: Page): Promise<void> => {
  const debugToolbar = page.locator('.debug-toolbar');
  await debugToolbar.waitFor({ state: 'visible', timeout: 30_000 });
  const continueButton = debugToolbar.getByRole('button', { name: /Continue/i }).first();
  await expect(async () => {
    if (await debugToolbar.isVisible({ timeout: 500 }).catch(() => false)) {
      await continueButton.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      throw new Error('debug session still active');
    }
  }).toPass({ timeout: JEST_RUN_TIMEOUT });
};

/**
 * After debugging, focus the Test Explorer and wait for the passed icon.
 * Avoids "Test: Refresh Tests" because refreshing wipes run-result icons on Windows/Linux.
 */
const waitForDebugTestItemPassed = async (page: Page, label: string): Promise<void> => {
  await focusTestExplorerAndWaitForPassed(page, label);
};

// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await waitForWorkspaceReady(page);
});

test('LWC Debug Tests: debug all via Test Explorer sidebar', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create two LWC components', async () => {
    await createLwc(page, 'lwc1');
    await createLwc(page, 'lwc2');
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
    await saveScreenshot(page, 'debug-all.lsp-ready.png');
  });

  await test.step('open and refresh Test Explorer', async () => {
    await openAndRefreshTestExplorer(page);
    await saveScreenshot(page, 'debug-all.test-explorer-open.png');
  });

  await test.step('click Debug Test action on lwc1 tree item', async () => {
    const lwc1 = testItem(page, 'lwc1');
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    await lwc1.click();
    const debugButton = lwc1.getByRole('button', { name: /^Debug Test/ });
    await debugButton.waitFor({ state: 'visible', timeout: 10_000 });
    await debugButton.click();
    await saveScreenshot(page, 'debug-all.after-click.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
    await saveScreenshot(page, 'debug-all.session-done.png');
  });

  await test.step('verify lwc1 passes in Test Explorer', async () => {
    await waitForDebugTestItemPassed(page, 'lwc1');
    await saveScreenshot(page, 'debug-all.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Debug Tests: debug single test case via Test Explorer sidebar', async ({ page }) => {
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

  await test.step('expand lwc1 and debug the generated test case', async () => {
    const lwc1 = testItem(page, 'lwc1');
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    await lwc1.click();
    await page.waitForTimeout(1000);

    const testCase = testItem(page, 'TODO: test case generated by CLI command');
    await testCase.waitFor({ state: 'visible', timeout: 15_000 });
    await testCase.scrollIntoViewIfNeeded();
    // Click to select; retry with force if an overlay tooltip intercepts
    await expect(async () => {
      await testCase.click({ force: true });
      await testCase.hover({ force: true });
      const debugButton = testCase.getByRole('button', { name: /^Debug Test/ });
      await debugButton.waitFor({ state: 'visible', timeout: 3000 });
      await debugButton.click({ force: true });
    }).toPass({ timeout: 30_000 });
    await saveScreenshot(page, 'debug-single.after-click.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
  });

  await test.step('verify lwc1 passes in Test Explorer', async () => {
    await waitForDebugTestItemPassed(page, 'lwc1');
    await saveScreenshot(page, 'debug-single.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Debug Tests: debug current test file from command palette', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc1');
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc1.test.js');
    await saveScreenshot(page, 'cmd-palette-debug.test-file-open.png');
  });

  await test.step('debug via command palette', async () => {
    await executeCommandWithCommandPalette(page, 'SFDX: Debug Current Lightning Web Component Test File');
    await saveScreenshot(page, 'cmd-palette-debug.after-command.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
    await saveScreenshot(page, 'cmd-palette-debug.session-done.png');
  });

  await test.step('verify lwc1 passes in Test Explorer', async () => {
    await waitForDebugTestItemPassed(page, 'lwc1');
    await saveScreenshot(page, 'cmd-palette-debug.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Debug Tests: debug current test file from editor toolbar button', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc2');
    await openLwcFile(page, 'lwc2.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc2.test.js');
    await saveScreenshot(page, 'toolbar-debug.test-file-open.png');
  });

  await test.step('click Debug Current LWC Test File toolbar button', async () => {
    const toolbarButton = page.locator('.editor-actions').getByRole('button', {
      name: /SFDX: Debug Current Lightning Web Component Test File/i
    });
    await toolbarButton.waitFor({ state: 'visible', timeout: 15_000 });
    await toolbarButton.click();
    await saveScreenshot(page, 'toolbar-debug.after-click.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
    await saveScreenshot(page, 'toolbar-debug.session-done.png');
  });

  await test.step('verify lwc2 passes in Test Explorer', async () => {
    await waitForDebugTestItemPassed(page, 'lwc2');
    await saveScreenshot(page, 'toolbar-debug.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
