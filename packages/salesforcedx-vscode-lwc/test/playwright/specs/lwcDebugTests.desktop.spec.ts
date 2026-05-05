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

// Jest debug runs take a while — give each test plenty of headroom
const JEST_RUN_TIMEOUT = 3 * 60 * 1000;

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await waitForWorkspaceReady(page);
});

test('LWC Debug Tests: debug all via Test Explorer sidebar', async ({ page, workspaceDir }) => {
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
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await page.waitForTimeout(2000);
    await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
    await page.waitForTimeout(3000);
    await saveScreenshot(page, 'debug-all.test-explorer-open.png');
  });

  let runStartMs: number;
  await test.step('click Debug Test action on lwc1 tree item', async () => {
    const lwc1 = page.getByRole('treeitem', { name: /lwc1/i });
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    await lwc1.click();
    const debugButton = lwc1.getByRole('button', { name: /^Debug Test/ });
    await debugButton.waitFor({ state: 'visible', timeout: 10_000 });
    runStartMs = Date.now();
    await debugButton.click();
    await saveScreenshot(page, 'debug-all.after-click.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
    await saveScreenshot(page, 'debug-all.session-done.png');
  });

  await test.step('verify lwc1 passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'debug-all.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Debug Tests: debug single test case via Test Explorer sidebar', async ({ page, workspaceDir }) => {
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
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await page.waitForTimeout(2000);
    await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
    await page.waitForTimeout(3000);
  });

  let runStartMs: number;
  await test.step('expand lwc1 and debug the generated test case', async () => {
    const lwc1 = page.getByRole('treeitem', { name: /lwc1/i });
    await lwc1.waitFor({ state: 'visible', timeout: 30_000 });
    await lwc1.click();
    await page.waitForTimeout(1000);

    const testCase = page.getByRole('treeitem', { name: /TODO: test case generated by CLI command/i });
    await testCase.waitFor({ state: 'visible', timeout: 15_000 });
    await testCase.scrollIntoViewIfNeeded();
    // Click to select; retry with force if an overlay tooltip intercepts
    await expect(async () => {
      await testCase.click({ force: true });
      await testCase.hover({ force: true });
      const debugButton = testCase.getByRole('button', { name: /^Debug Test/ });
      await debugButton.waitFor({ state: 'visible', timeout: 3000 });
      runStartMs = Date.now();
      await debugButton.click({ force: true });
    }).toPass({ timeout: 30_000 });
    await saveScreenshot(page, 'debug-single.after-click.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
  });

  await test.step('verify lwc1 passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'debug-single.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Debug Tests: debug current test file from command palette', async ({ page, workspaceDir }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc1');
    await openLwcFile(page, 'lwc1.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc1.test.js');
    await saveScreenshot(page, 'cmd-palette-debug.test-file-open.png');
  });

  let runStartMs: number;
  await test.step('debug via command palette', async () => {
    runStartMs = Date.now();
    await executeCommandWithCommandPalette(page, 'SFDX: Debug Current Lightning Web Component Test File');
    await saveScreenshot(page, 'cmd-palette-debug.after-command.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
    await saveScreenshot(page, 'cmd-palette-debug.session-done.png');
  });

  await test.step('verify lwc1 passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'cmd-palette-debug.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});

test('LWC Debug Tests: debug current test file from editor toolbar button', async ({ page, workspaceDir }) => {
  test.setTimeout(10 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create LWC component and open test file', async () => {
    await createLwc(page, 'lwc2');
    await openLwcFile(page, 'lwc2.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwc2.test.js');
    await saveScreenshot(page, 'toolbar-debug.test-file-open.png');
  });

  let runStartMs: number;
  await test.step('click Debug Current LWC Test File toolbar button', async () => {
    const toolbarButton = page.locator('.editor-actions').getByRole('button', {
      name: /SFDX: Debug Current Lightning Web Component Test File/i
    });
    await toolbarButton.waitFor({ state: 'visible', timeout: 15_000 });
    runStartMs = Date.now();
    await toolbarButton.click();
    await saveScreenshot(page, 'toolbar-debug.after-click.png');
  });

  await test.step('continue past debugger pauses until session ends', async () => {
    await continueDebuggingUntilDone(page);
    await saveScreenshot(page, 'toolbar-debug.session-done.png');
  });

  await test.step('verify lwc2 passes', async () => {
    await waitForJestResults(workspaceDir, runStartMs!);
    await saveScreenshot(page, 'toolbar-debug.results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
