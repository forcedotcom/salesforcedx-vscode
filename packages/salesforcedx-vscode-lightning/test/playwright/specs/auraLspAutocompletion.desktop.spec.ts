/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToLineCol,
  openFileByName,
  openFileFromExplorerTree,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';

import { isContainer, test } from '../fixtures';
import { waitForAuraLspReady } from '../utils/auraLspUtils';

// force-app/main/default/aura/aura1 on desktop (fixtures/desktopFixtures.ts seeds it there); the
// container's bind-mounted fixture project uses the same layout, so the path is shared.
const AURA1_DIR = ['force-app', 'main', 'default', 'aura', 'aura1'];

// Specs are independent (separate VS Code session per spec on desktop; the container reuses one
// shared, persistent workbench), so the Aura LS re-indexes the pre-seeded aura1 bundle here. Types
// `<aura:appl` at L2 C1 (the blank tab line in the seeded `aura1.cmp`), selects the
// `aura:application` completion, and asserts it was inserted.
test('Aura LSP: autocompletion', async ({ page }) => {
  if (isContainer) {
    test.setTimeout(3 * 60 * 1000);
  }
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Scope to the suggest widget so other monaco lists (file picker, quick open) can't match
  // (lwcLspAutocompletion precedent). `.show-file-icons` further filters the completion rows.
  const completionRows = page.locator('.editor-widget.suggest-widget .monaco-list-row.show-file-icons');

  await test.step('setup', async () => {
    // No-op once ready (container's fixture already awaited it); the real wait on desktop.
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (isContainer) {
      // First container boot stacks telemetry/what's-new toasts that can cover the editor.
      await clearAllNotifications(page);
    } else {
      await waitForWorkspaceReady(page);
    }
  });

  await test.step('open aura1.cmp and wait for indexing complete', async () => {
    if (isContainer) {
      await openFileFromExplorerTree(page, 'aura1.cmp', AURA1_DIR);
    } else {
      await openFileByName(page, 'aura1.cmp');
    }
    await waitForAuraLspReady(page);
    await saveScreenshot(page, 'auraLspAutocompletion.indexing-complete.png');
  });

  await test.step('type <aura:appl and select the aura:application completion', async () => {
    // L2 is the blank tab line per the seeded layout (fixtures/desktopFixtures.ts) — load-bearing
    // typing target.
    await goToLineCol(page, 2, 1);
    await page.keyboard.type('<aura:appl');

    const firstRow = completionRows.first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await expect(firstRow).toHaveAttribute('aria-label', /aura:application/, { timeout: 30_000 });
    await firstRow.click();

    // Close the tag and save.
    await page.keyboard.type('>');
    await saveFile(page);
  });

  await test.step('verify aura:application was inserted on L2', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="aura1.cmp"]`).first();
    const lineTwo = editor.locator('.view-line').nth(1);
    await expect(lineTwo).toContainText('aura:application', { timeout: 15_000 });
    await saveScreenshot(page, 'auraLspAutocompletion.inserted.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
