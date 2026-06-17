/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  goToLineCol,
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { waitForAuraLspReady } from '../utils/auraLspUtils';

// Migrated from WDIO `auraLsp.e2e.ts` "Autocompletion". Specs are independent (separate VS Code
// session per spec), so the Aura LS re-indexes the pre-seeded aura1 bundle here. Types `<aura:appl`
// at L2 C1 (the blank tab line in the seeded `aura1.cmp`), selects the `aura:application`
// completion, and asserts it was inserted.
test('Aura LSP: autocompletion', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Scope to the suggest widget so other monaco lists (file picker, quick open) can't match
  // (lwcLspAutocompletion precedent). `.show-file-icons` further filters the completion rows.
  const completionRows = page.locator('.editor-widget.suggest-widget .monaco-list-row.show-file-icons');

  await test.step('setup', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  await test.step('open aura1.cmp and wait for indexing complete', async () => {
    await openFileByName(page, 'aura1.cmp');
    await waitForAuraLspReady(page);
    await saveScreenshot(page, 'auraLspAutocompletion.indexing-complete.png');
  });

  await test.step('type <aura:appl and select the aura:application completion', async () => {
    // L2 is the blank tab line per the seeded layout (fixtures/desktopFixtures.ts) — load-bearing
    // typing target, mirrors WDIO `typeTextAt(2, 1, '<aura:appl')`.
    await goToLineCol(page, 2, 1);
    await page.keyboard.type('<aura:appl');

    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await expect(firstRow).toHaveAttribute('aria-label', /aura:application/, { timeout: 30_000 });
    await firstRow.click();

    // Close the tag and save (mirrors WDIO `typeText('>')` + `save()`).
    await page.keyboard.type('>');
    await executeCommandWithCommandPalette(page, 'File: Save');
  });

  await test.step('verify aura:application was inserted on L2', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="aura1.cmp"]`).first();
    const lineTwo = editor.locator('.view-line').nth(1);
    await expect(lineTwo).toContainText('aura:application', { timeout: 15_000 });
    await saveScreenshot(page, 'auraLspAutocompletion.inserted.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
