/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable unicorn/numeric-separators-style -- timeouts use plain numeric literals; rule conflicts for 4–5 digit values */

import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  executeCommandWithCommandPalette,
  openFileByName,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { waitForApexLspReady } from '../utils/apexLspUtils';

test('Apex LSP: indexing, go-to-definition, autocompletion', async ({ page, workspaceDir }) => {
  // timeout comes from playwright.config.desktop.ts (timeout: 360_000)
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open ExampleClass.cls and wait for indexing complete', async () => {
    // Files were pre-seeded onto disk before Electron launched (see fixtures/desktopFixtures.ts);
    // jorje picks them up during its startup scan, so no reloadWindow workaround is needed.
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
    await saveScreenshot(page, 'step.indexing-complete.png');
  });

  await test.step('Go to Definition from ExampleClassTest into ExampleClass', async () => {
    // Use Explorer tree instead of Quick Open — VS Code's file-search index may not have
    // discovered the pre-seeded file yet (only "recently opened" files appear reliably).
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['classes']);
    // Wait for ExampleClassTest.cls to become the active tab before issuing editor commands;
    // openFileFromExplorerTree resolves on any visible editor, which may be the previously-opened
    // ExampleClass.cls — causing Go to Line and Go to Definition to target the wrong file.
    const testTab = page.getByRole('tab', { name: 'ExampleClassTest.cls', exact: true }).first();
    await expect(testTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Position caret on the `ExampleClass` reference (line 5, col 20 in the seeded test class)
    await executeCommandWithCommandPalette(page, 'Go to Line/Column...');
    await page.keyboard.type('5:20');
    await page.keyboard.press('Enter');

    await executeCommandWithCommandPalette(page, 'Go to Definition');

    const exampleClassTab = page.getByRole('tab', { name: 'ExampleClass.cls', exact: true }).first();
    await expect(exampleClassTab).toHaveAttribute('aria-selected', 'true', { timeout: 30000 });
    await saveScreenshot(page, 'step.go-to-definition.png');
  });

  await test.step('Autocompletion suggests SayHello and inserts call', async () => {
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['classes']);
    // Wait for ExampleClassTest.cls to become the active tab (same race as Go to Definition step).
    const testTab = page.getByRole('tab', { name: 'ExampleClassTest.cls', exact: true }).first();
    await expect(testTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    // Insert "\tExampleClass.say" at line 7 col 1, mirroring the WDIO sequence (apexLsp.e2e.ts:155).
    await executeCommandWithCommandPalette(page, 'Go to Line/Column...');
    await page.keyboard.type('7:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('\tExampleClass.say');

    // `.show-file-icons` filters out Quick Pick / file-explorer monaco-list-row variants — matches
    // the WDIO selector at apexLsp.e2e.ts:159 and avoids matching unrelated rows in the workbench.
    const completionRows = page.locator('div.monaco-list-row.show-file-icons');
    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30000 });
    await expect(firstRow).toHaveAttribute('aria-label', /SayHello\(name\)/, { timeout: 30000 });
    await firstRow.click();

    // Type the argument; the completion inserted `SayHello(name)` with `name` selected as snippet placeholder.
    await page.keyboard.type("'Jack");
    // Position at col 38 (after `);`) and append `;` to mirror WDIO line 165.
    await executeCommandWithCommandPalette(page, 'Go to Line/Column...');
    await page.keyboard.type('7:38');
    await page.keyboard.press('Enter');
    await page.keyboard.type(';');
    await executeCommandWithCommandPalette(page, 'File: Save');

    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="ExampleClassTest.cls"]`).first();
    const lineSeven = editor.locator('.view-line').nth(6);
    await expect(lineSeven).toContainText("ExampleClass.SayHello('Jack');", { timeout: 15000 });
    await saveScreenshot(page, 'step.autocompletion.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
