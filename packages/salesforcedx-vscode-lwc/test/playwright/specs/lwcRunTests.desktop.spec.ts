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

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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

/**
 * Poll `.sfdx/tools/testresults/lwc/` for a Jest JSON result file written after `afterMs`.
 * The LWC extension writes one JSON file per run (test-result-<uuid>.json); we consider
 * the run successful when any new file has numFailedTestSuites === 0.
 */
const waitForJestResults = async (workspaceDir: string, afterMs: number, timeout = JEST_RUN_TIMEOUT): Promise<void> => {
  const resultsDir = path.join(workspaceDir, '.sfdx', 'tools', 'testresults', 'lwc');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const files = await fs.readdir(resultsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(resultsDir, file);
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < afterMs) continue;
        const content = await fs.readFile(filePath, 'utf8');
        const result = JSON.parse(content) as { numFailedTestSuites?: number; numPassedTestSuites?: number };
        if ((result.numFailedTestSuites ?? 1) === 0 && (result.numPassedTestSuites ?? 0) > 0) {
          return;
        }
        if ((result.numFailedTestSuites ?? 0) > 0) {
          throw new Error(`Jest run failed: ${result.numFailedTestSuites} suite(s) failed`);
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Jest result file not found in ${resultsDir} within ${timeout}ms`);
};

/** Focus the Test Explorer view and refresh test items. */
const openAndRefreshTestExplorer = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
  await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
  // Tree populated with the lwc1 item = discovery done (all callers create lwc1 first).
  // toBeVisible polls internally, so no waitForTimeout / toPass wrapper is needed.
  await expect(testItem(page, 'lwc1')).toBeVisible({ timeout: 30_000 });
};

// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await waitForWorkspaceReady(page);
});

test('LWC Run Tests: run all via Test Explorer and verify both suites pass', async ({ page, workspaceDir }) => {
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

  let runStartMs: number;
  await test.step('run all LWC tests', async () => {
    runStartMs = Date.now();
    await executeCommandWithCommandPalette(page, 'Test: Run All Tests');
    await saveScreenshot(page, 'run-all.after-run-command.png');
  });

  await test.step('verify both suites pass', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'run-all.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run single component tests via Test Explorer sidebar', async ({ page, workspaceDir }) => {
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

  let runStartMs: number;
  await test.step('click Run Test action button on lwc1 tree item', async () => {
    const lwc1 = testItem(page, 'lwc1');
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    await lwc1.click();
    const runButton = lwc1.getByRole('button', { name: /^Run Test/ });
    await runButton.waitFor({ state: 'visible', timeout: 10_000 });
    runStartMs = Date.now();
    await runButton.click();
    await saveScreenshot(page, 'sidebar-run.after-click.png');
  });

  await test.step('verify lwc1 test suite passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'sidebar-run.passed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run single test case via Test Explorer sidebar', async ({ page, workspaceDir }) => {
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

  let runStartMs: number;
  await test.step('expand lwc1 and run the generated test case', async () => {
    const lwc1 = testItem(page, 'lwc1');
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    // Expand the file node to reveal child test cases
    await lwc1.click();
    await page.waitForTimeout(1000);

    const testCase = testItem(page, 'TODO: test case generated by CLI command');
    await testCase.waitFor({ state: 'visible', timeout: 15_000 });
    // Dismiss the hover tooltip from clicking lwc1 — it intercepts pointer events on Windows.
    await page.keyboard.press('Escape');
    await testCase.click();
    const runButton = testCase.getByRole('button', { name: /^Run Test/ });
    await runButton.waitFor({ state: 'visible', timeout: 10_000 });
    runStartMs = Date.now();
    await runButton.click();
    await saveScreenshot(page, 'single-case.after-click.png');
  });

  await test.step('verify test case passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'single-case.passed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run current test file from command palette', async ({ page, workspaceDir }) => {
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

  let runStartMs: number;
  await test.step('run via command palette', async () => {
    runStartMs = Date.now();
    await executeCommandWithCommandPalette(page, 'SFDX: Run Current Lightning Web Component Test File');
    await saveScreenshot(page, 'cmd-palette-run.after-command.png');
  });

  await test.step('verify test file passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'cmd-palette-run.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

// Code lens tests are desktop-only and flaky on Linux (see original automation test skip comment)
test('LWC Run Tests: run all tests via Run All Tests code lens', async ({ page, workspaceDir }) => {
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

  let runStartMs: number;
  await test.step('click Run All Tests code lens', async () => {
    const editor = page.locator('[data-uri*="lwc1.test.js"]');
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    // Code lenses appear above the describe block — wait for the "Run All Tests" link
    const runAllLens = page.getByRole('button', { name: /Run All Tests/i }).first();
    await runAllLens.waitFor({ state: 'visible', timeout: 30_000 });
    runStartMs = Date.now();
    await runAllLens.click();
    await saveScreenshot(page, 'codelens-all.after-click.png');
  });

  await test.step('verify suite passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'codelens-all.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run single test via Run Test code lens', async ({ page, workspaceDir }) => {
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

  let runStartMs: number;
  await test.step('click Run Test code lens on first it() block', async () => {
    // The "Run Test" code lens appears above the it() call — find the first one
    const runLens = page.getByRole('button', { name: /^Run Test$/i }).first();
    await runLens.waitFor({ state: 'visible', timeout: 30_000 });
    runStartMs = Date.now();
    await runLens.click();
    await saveScreenshot(page, 'codelens-single.after-click.png');
  });

  await test.step('verify test suite passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'codelens-single.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Run Tests: run current test file from editor toolbar button', async ({ page, workspaceDir }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc2');
    await openLwcFile(page, 'lwc2.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc2.test.js');
    await saveScreenshot(page, 'toolbar-run.test-file-open.png');
  });

  let runStartMs: number;
  await test.step('click Run Current LWC Test File toolbar button', async () => {
    const toolbarButton = page
      .locator('.editor-actions')
      .getByRole('button', { name: /SFDX: Run Current Lightning Web Component Test File/i });
    await toolbarButton.waitFor({ state: 'visible', timeout: 15_000 });
    runStartMs = Date.now();
    await toolbarButton.click();
    await saveScreenshot(page, 'toolbar-run.after-click.png');
  });

  await test.step('verify test suite passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'toolbar-run.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
