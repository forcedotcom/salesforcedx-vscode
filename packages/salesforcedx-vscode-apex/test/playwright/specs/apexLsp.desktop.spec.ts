/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
    await expect(testTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

    // Locate the `ExampleClass` token on line 5 of ExampleClassTest.cls. Use Ctrl/Cmd+Click
    // directly on the token — this is more reliable than command palette "Go to Definition"
    // because it guarantees the editor has focus and the click target is the resolved symbol.
    const testEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="ExampleClassTest.cls"]`).first();
    // Line 5 contains `ExampleClass.SayHello('Cody')` — find the span with `ExampleClass` text.
    // The `.view-lines` container holds all rendered lines; filter to the specific token.
    const exampleClassToken = testEditor
      .locator('.view-lines span')
      .filter({ hasText: /^ExampleClass$/ })
      .first();
    await exampleClassToken.waitFor({ state: 'visible', timeout: 10_000 });

    // Hover the token and wait for a hover tooltip to confirm the Apex LSP has resolved the
    // symbol. Without this synchronization the LSP may not have finished processing the file
    // and Ctrl+Click would yield no navigation.
    await exampleClassToken.hover();
    await expect(
      page.locator('.monaco-hover').filter({ hasText: /ExampleClass/ }),
      'hover tooltip should show ExampleClass type info before Ctrl+Click'
    ).toBeVisible({ timeout: 60_000 });

    // Ctrl+Click (Cmd+Click on macOS) triggers Go to Definition on the hovered token.
    await exampleClassToken.click({ modifiers: ['ControlOrMeta'] });

    // Go to Definition may open a peek widget (inline reference view) instead of switching
    // tabs when the target file is already open. Detect and dismiss it with Enter to navigate.
    const peekWidget = page.locator('.peekview-widget');
    const peekVisible = await peekWidget
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (peekVisible) {
      // Enter in the peek widget navigates to the definition in the main editor
      await page.keyboard.press('Enter');
    }

    const exampleClassTab = page.getByRole('tab', { name: 'ExampleClass.cls', exact: true }).first();
    await expect(exampleClassTab).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await saveScreenshot(page, 'step.go-to-definition.png');
  });

  await test.step('Autocompletion suggests SayHello and inserts call', async () => {
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['classes']);
    // Wait for ExampleClassTest.cls to become the active tab (same race as Go to Definition step).
    const testTab = page.getByRole('tab', { name: 'ExampleClassTest.cls', exact: true }).first();
    await expect(testTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    // Insert "\tExampleClass.say" at line 7 col 1, mirroring the WDIO sequence (apexLsp.e2e.ts:155).
    await executeCommandWithCommandPalette(page, 'Go to Line/Column...');
    await page.keyboard.type('7:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('\tExampleClass.say');

    // `.show-file-icons` filters out Quick Pick / file-explorer monaco-list-row variants — matches
    // the WDIO selector at apexLsp.e2e.ts:159 and avoids matching unrelated rows in the workbench.
    const completionRows = page.locator('div.monaco-list-row.show-file-icons');
    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await expect(firstRow).toHaveAttribute('aria-label', /SayHello\(name\)/, { timeout: 30_000 });
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
    await expect(lineSeven).toContainText("ExampleClass.SayHello('Jack');", { timeout: 15_000 });
    await saveScreenshot(page, 'step.autocompletion.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
