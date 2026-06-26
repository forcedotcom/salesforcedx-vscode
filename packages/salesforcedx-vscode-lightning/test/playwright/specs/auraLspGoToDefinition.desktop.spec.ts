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
  goToDefinition,
  goToLineCol,
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
import { waitForAuraLspReady } from '../utils/auraLspUtils';

// The aura1 bundle is pre-seeded onto disk before launch (fixtures/desktopFixtures.ts); the Aura LS
// indexes it on its startup scan. Go to Definition here is WITHIN-file: ref site L8
// `{!v.simpleNewContact}` → def site L3 `<aura:attribute name="simpleNewContact" …/>`.
//
// The Go to Definition command MUST run with `preserveSelection: true`. Without it,
// `openCommandPalette` clicks the workbench center to grab keyboard focus before F1; for this
// 10-line file the editor center is below the last line, so VS Code re-parks the cursor at
// end-of-document and the LSP then receives `onDefinition` at end-of-doc — where there is no
// binding — returning "No definition found" (cursor ends at `Ln 10, Col 18`). The packaged server
// resolves the L8 binding correctly when the request fires at 8:15. `preserveSelection` skips that
// focus-click (and the selection-clearing Escape), keeping the cursor where the test placed it.
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
    // Place the cursor inside `simpleNewContact` on the ref line (8:15). Click the editor first so
    // it owns focus before the command-palette
    // cursor placement (mirrors lwcLspGoToDefinitionHtml precedent); without focus, the
    // subsequent Go to Definition runs against a stale/unfocused editor and resolves nothing.
    await page.locator(`${EDITOR_WITH_URI}[data-uri$="aura1.cmp"]`).first().click();
    await goToLineCol(page, 8, 15);
    await expect(positionItem).toContainText(/Ln 8, Col 15/, { timeout: 10_000 });
    await saveScreenshot(page, 'auraLspGoToDefinition.cursor-placed.png');
  });

  await test.step('Go to Definition lands on the attribute definition (L3)', async () => {
    // Within-file nav (no new tab), so no Ctrl+Click (apex used Ctrl+Click only for its
    // cross-file nav). LSP readiness already
    // synced by `waitForAuraLspReady`. Use the command palette (lwcLspGoToDefinitionHtml precedent)
    // rather than F12, which is more host/environment-sensitive (can be intercepted as a global
    // shortcut). `preserveSelection` keeps the 8:15 cursor placed above — otherwise the palette's
    // workbench focus-click re-parks the cursor at end-of-document (below the last line of this
    // 10-line file) and Go to Definition resolves nothing.
    await goToDefinition(page, { preserveSelection: true });

    // PRIMARY: the VS Code status-bar selection item reports the cursor position. The Aura LS
    // resolves the def to the `simpleNewContact` name-attribute value range on L3
    // (`getAuraBindingTemplateDeclaration`); Go to Definition selects that range and places the
    // cursor at its END. Local run 2026-06-12 (test:desktop, VS Code 1.124.2): status bar read
    // exactly `Ln 3, Col 27`, so the assertion is locked to the exact value.
    await expect(positionItem).toContainText(/Ln 3, Col 27/, { timeout: 15_000 });

    // SECONDARY (defense): aura1.cmp is still the active tab — confirms within-file nav (no spurious
    // new tab / peek editor).
    const auraTab = page.getByRole('tab', { name: /aura1\.cmp/ }).first();
    await expect(auraTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await saveScreenshot(page, 'auraLspGoToDefinition.go-to-definition.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
