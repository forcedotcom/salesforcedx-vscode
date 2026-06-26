/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  goToLineColumn,
  openFileByName,
  openFileFromExplorerTree,
  saveFile,
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

  // `.show-file-icons` filters out Quick Pick / file-explorer monaco-list-row variants and
  // avoids matching unrelated rows in the workbench. Reused by both autocompletion steps.
  const completionRows = page.locator('div.monaco-list-row.show-file-icons');

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

    // Ctrl+Click (Cmd+Click on macOS) triggers Go to Definition on the hovered token. The
    // `editor.gotoLocation.*: 'goto'` settings (fixtures/desktopFixtures.ts) make this navigate
    // directly to the definition tab instead of opening a peek widget.
    await exampleClassToken.click({ modifiers: ['ControlOrMeta'] });

    const exampleClassTab = page.getByRole('tab', { name: 'ExampleClass.cls', exact: true }).first();
    await expect(exampleClassTab).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await saveScreenshot(page, 'step.go-to-definition.png');
  });

  await test.step('Autocompletion suggests SayHello and inserts call', async () => {
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['classes']);
    // Wait for ExampleClassTest.cls to become the active tab (same race as Go to Definition step).
    const testTab = page.getByRole('tab', { name: 'ExampleClassTest.cls', exact: true }).first();
    await expect(testTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    // Line 7 is blank per fixture layout (desktopFixtures.ts:37) — load-bearing for autocompletion test.
    // Insert "\tExampleClass.say" at line 7 col 1 to trigger autocompletion.
    await goToLineColumn(page);
    await page.keyboard.type('7:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('\tExampleClass.say');

    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await expect(firstRow).toHaveAttribute('aria-label', /SayHello\(name\)/, { timeout: 30_000 });
    await firstRow.click();

    // Type the argument; the completion inserted `SayHello(name)` with `name` selected as snippet placeholder.
    await page.keyboard.type("'Jack");
    // Position at col 38 (after `);`) and append `;`.
    await goToLineColumn(page);
    await page.keyboard.type('7:38');
    await page.keyboard.press('Enter');
    await page.keyboard.type(';');
    await saveFile(page);

    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="ExampleClassTest.cls"]`).first();
    const lineSeven = editor.locator('.view-line').nth(6);
    await expect(lineSeven).toContainText("ExampleClass.SayHello('Jack');", { timeout: 15_000 });
    await saveScreenshot(page, 'step.autocompletion.png');
  });

  await test.step('Anonymous Apex autocompletion', async () => {
    // ExampleAnon.apex is pre-seeded at workspace-root scripts/apex (desktopFixtures.ts) — open via
    // Explorer tree since Quick Open's file-search index may not have discovered it yet. The
    // ['scripts', 'apex'] path tolerates VS Code compact-folder rendering (missing intermediate
    // rows are skipped, leaf still reached).
    await openFileFromExplorerTree(page, 'ExampleAnon.apex', ['scripts', 'apex']);
    const anonTab = page.getByRole('tab', { name: 'ExampleAnon.apex', exact: true }).first();
    await expect(anonTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

    // Line 2 is blank per fixture layout (desktopFixtures.ts EXAMPLE_ANON) — load-bearing typing target.
    // Type `ExampleClass.say` to exercise cross-file project-symbol completion from a .apex buffer.
    // Whether anonymous Apex resolves project ApexClass symbols through the same jorje LSP is not
    // runtime-confirmed locally (see .claude/plans/W-22918963.md "Symbol-resolution risk"); CI is the
    // verification path for this assertion.
    await goToLineColumn(page);
    await page.keyboard.type('2:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('ExampleClass.say');

    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await expect(firstRow).toHaveAttribute('aria-label', /SayHello\(name\)/, { timeout: 30_000 });
    await saveScreenshot(page, 'step.anon-autocompletion.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
