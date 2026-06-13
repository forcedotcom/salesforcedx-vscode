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
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { goToLineCol, waitForAuraLspReady } from '../utils/auraLspUtils';

// Migrated from WDIO `auraLsp.e2e.ts` "Go to Definition". The aura1 bundle is pre-seeded onto disk
// before launch (fixtures/desktopFixtures.ts); the Aura LS indexes it on its startup scan, so no
// `reloadWindow` workaround is needed. Go to Definition here is WITHIN-file: ref site L8
// `{!v.simpleNewContact}` → def site L3 `<aura:attribute name="simpleNewContact" …/>` (col 27).
test('Aura LSP: go to definition', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  await test.step('open aura1.cmp and wait for indexing complete', async () => {
    await openFileByName(page, 'aura1.cmp');
    await waitForAuraLspReady(page);
    await saveScreenshot(page, 'auraLspGoToDefinition.indexing-complete.png');
  });

  const positionItem = page.locator(WORKBENCH).getByRole('button', { name: /Ln \d+, Col \d+/ });

  await test.step('position cursor on the simpleNewContact reference (L8)', async () => {
    // Mirrors WDIO `moveCursorWithFallback(textEditor, 8, 15)` — cursor inside `simpleNewContact`
    // on the ref line. Click the editor first so it owns focus before the command-palette
    // cursor placement (mirrors lwcLspGoToDefinitionHtml precedent); without focus, the
    // subsequent Go to Definition runs against a stale/unfocused editor and resolves nothing.
    await page.locator(`${EDITOR_WITH_URI}[data-uri$="aura1.cmp"]`).first().click();
    await goToLineCol(page, 8, 15);
    await expect(positionItem).toContainText(/Ln 8, Col 15/, { timeout: 10_000 });
    await saveScreenshot(page, 'auraLspGoToDefinition.cursor-placed.png');
  });

  await test.step('Go to Definition lands on the attribute definition (L3)', async () => {
    // Matches WDIO `executeQuickPick('Go to Definition')` / F12. Within-file nav (no new tab), so
    // no Ctrl+Click (apex used Ctrl+Click only for its cross-file nav). LSP readiness already
    // synced by `waitForAuraLspReady`. Press F12 directly (not the palette) so the command runs
    // against the focused editor at the cursor we just set — the palette open/close cycle can drop
    // editor focus / cursor and yield a no-op "No definition found".
    await page.keyboard.press('F12');

    // PRIMARY: the VS Code status-bar selection item reports the cursor position. The Aura LS
    // resolves the def to the `simpleNewContact` name-attribute value range on L3
    // (`getAuraBindingTemplateDeclaration`); Go to Definition selects that range and places the
    // cursor at its END. Local run 2026-06-12 (test:desktop, VS Code 1.124.2): status bar read
    // exactly `Ln 3, Col 27` — matches WDIO `getCoordinates()` → [3, 27], so the assertion is
    // locked to the exact value.
    await expect(positionItem).toContainText(/Ln 3, Col 27/, { timeout: 15_000 });

    // SECONDARY (defense): aura1.cmp is still the active tab — confirms within-file nav (no spurious
    // new tab / peek editor).
    const auraTab = page.getByRole('tab', { name: /aura1\.cmp/ }).first();
    await expect(auraTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await saveScreenshot(page, 'auraLspGoToDefinition.go-to-definition.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
