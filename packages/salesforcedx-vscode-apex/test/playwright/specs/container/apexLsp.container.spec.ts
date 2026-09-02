/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the desktop Apex LSP twin (apexLsp.desktop.spec.ts), per ADR 0022. The
 * desktop twin proves indexing / go-to-definition / autocompletion (incl. anonymous Apex) against
 * the jorje language server in Electron; this proves the SAME desktop Apex LSP answers those
 * requests inside the Code Builder image, where the workbench is served to a browser Page but the
 * Apex extension runs in the Node host.
 *
 * No org setup and no file seeding: the container boots with one authed org already and the fixture
 * project is bind-mounted, so ExampleClass.cls / ExampleClassTest.cls (force-app/main/default/
 * classes) and ExampleAnon.apex (scripts/apex) already exist on disk with the exact layout the
 * desktop twin seeds (blank line 7 in ExampleClassTest, blank line 2 in ExampleAnon). We open them
 * instead of writing them.
 *
 * The desktop twin's `waitForApexLspReady(page, workspaceDir)` also polls the workspace `.sfdx`
 * folder on disk; the container's workspace lives inside the image, so we wait on the UI-only signal
 * (the "Indexing complete" language-status button) instead. The `editor.gotoLocation.*: goto`
 * settings the twin injects via fixtures already ship in the mounted `.vscode/settings.json`.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToLineColumn,
  openFileFromExplorerTree,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';

/**
 * UI-only Apex LSP readiness: wait for the "Indexing complete" language-status button. The desktop
 * twin also checks StandardApexLibrary on disk, but the container's workspace is inside the image
 * (and boots pre-indexed), so the button alone is the reliable in-browser signal.
 */
const waitForApexLspReady = async (page: Page): Promise<void> => {
  await expect(page.getByRole('button', { name: /Indexing complete/ })).toBeVisible({ timeout: 120_000 });
};

test('Apex LSP (Code Builder): indexing, go-to-definition, autocompletion', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // `.show-file-icons` filters out Quick Pick / file-explorer monaco-list-row variants and
  // avoids matching unrelated rows in the workbench. Reused by both autocompletion steps.
  const completionRows = page.locator('div.monaco-list-row.show-file-icons');

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'apexLsp.container.01-ready.png');
  });

  await test.step('open ExampleClass.cls and wait for indexing complete', async () => {
    await openFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
    await waitForApexLspReady(page);
    await saveScreenshot(page, 'apexLsp.container.02-indexing-complete.png');
  });

  await test.step('Go to Definition from ExampleClassTest into ExampleClass', async () => {
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['force-app', 'main', 'default', 'classes']);
    // Wait for ExampleClassTest.cls to become the active tab before issuing editor commands;
    // openFileFromExplorerTree resolves on any visible editor, which may be the previously-opened
    // ExampleClass.cls — causing Go to Definition to target the wrong file.
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
    // `editor.gotoLocation.*: 'goto'` settings (mounted `.vscode/settings.json`) make this navigate
    // directly to the definition tab instead of opening a peek widget.
    await exampleClassToken.click({ modifiers: ['ControlOrMeta'] });

    const exampleClassTab = page.getByRole('tab', { name: 'ExampleClass.cls', exact: true }).first();
    await expect(exampleClassTab).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await saveScreenshot(page, 'apexLsp.container.03-go-to-definition.png');
  });

  await test.step('Autocompletion suggests SayHello and inserts call', async () => {
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['force-app', 'main', 'default', 'classes']);
    // Wait for ExampleClassTest.cls to become the active tab (same race as Go to Definition step).
    const testTab = page.getByRole('tab', { name: 'ExampleClassTest.cls', exact: true }).first();
    await expect(testTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    // Line 7 is blank per fixture layout — load-bearing for autocompletion test.
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
    await saveScreenshot(page, 'apexLsp.container.04-autocompletion.png');
  });

  await test.step('Anonymous Apex autocompletion', async () => {
    // ExampleAnon.apex lives at workspace-root scripts/apex — open via Explorer tree since Quick
    // Open's file-search index may not have discovered it yet. The ['scripts', 'apex'] path
    // tolerates VS Code compact-folder rendering (missing intermediate rows are skipped, leaf still
    // reached).
    await openFileFromExplorerTree(page, 'ExampleAnon.apex', ['scripts', 'apex']);
    const anonTab = page.getByRole('tab', { name: 'ExampleAnon.apex', exact: true }).first();
    await expect(anonTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

    // Line 2 is blank per fixture layout — load-bearing typing target. Type `ExampleClass.say` to
    // exercise cross-file project-symbol completion from a .apex buffer.
    await goToLineColumn(page);
    await page.keyboard.type('2:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('ExampleClass.say');

    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await expect(firstRow).toHaveAttribute('aria-label', /SayHello\(name\)/, { timeout: 30_000 });
    await saveScreenshot(page, 'apexLsp.container.05-anon-autocompletion.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
