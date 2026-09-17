/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Aura language server (ADR 0022). The desktop twin
 * (auraLspGoToDefinition.desktop.spec.ts) proves within-file Go to Definition in the Electron host;
 * this proves the same desktop-flavored Aura language server resolves definitions inside the Code
 * Builder image, where the container Page is browser-flavored (`isDesktop()` FALSE) yet the Node
 * host runs the desktop server. No org and no seeding: `aura1.cmp` already exists in the mounted
 * fixture workspace at force-app/main/default/aura/aura1 with the load-bearing layout — ref site L8
 * `{!v.simpleNewContact}` resolves to def site L3 `<aura:attribute name="simpleNewContact" …/>`.
 *
 * The Go to Definition command MUST run with `preserveSelection: true`. Without it,
 * `openCommandPalette` clicks the workbench center to grab keyboard focus before F1; for this
 * 10-line file the editor center is below the last line, so VS Code re-parks the cursor at
 * end-of-document and the LSP then receives `onDefinition` at end-of-doc — where there is no
 * binding — returning "No definition found". `preserveSelection` skips that focus-click (and the
 * selection-clearing Escape), keeping the cursor where the test placed it (8:15).
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToDefinition,
  goToLineCol,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { waitForAuraLspReady } from '../../utils/auraLspUtils';

test('Aura LSP (Code Builder): go to definition', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await clearAllNotifications(page);
    await saveScreenshot(page, 'auraLspGoToDefinition.container.01-ready.png');
  });

  await test.step('open aura1.cmp and wait for indexing complete', async () => {
    await openFileFromExplorerTree(page, 'aura1.cmp', ['force-app', 'main', 'default', 'aura', 'aura1']);
    await waitForAuraLspReady(page);
    await saveScreenshot(page, 'auraLspGoToDefinition.container.02-indexing-complete.png');
  });

  const positionItem = page.locator(WORKBENCH).getByRole('button', { name: /Ln \d+, Col \d+/ });

  await test.step('position cursor on the simpleNewContact reference (L8)', async () => {
    // Place the cursor inside `simpleNewContact` on the ref line (8:15). Click the editor first so
    // it owns focus before the command-palette cursor placement (mirrors lwcLspGoToDefinitionHtml
    // precedent); without focus, the subsequent Go to Definition runs against a stale/unfocused
    // editor and resolves nothing.
    await page.locator(`${EDITOR_WITH_URI}[data-uri$="aura1.cmp"]`).first().click();
    await goToLineCol(page, 8, 15);
    await expect(positionItem).toContainText(/Ln 8, Col 15/, { timeout: 10_000 });
    await saveScreenshot(page, 'auraLspGoToDefinition.container.03-cursor-placed.png');
  });

  await test.step('Go to Definition lands on the attribute definition (L3)', async () => {
    // Within-file nav (no new tab), so no Ctrl+Click. LSP readiness already synced by
    // `waitForAuraLspReady`. Use the command palette (lwcLspGoToDefinitionHtml precedent) rather
    // than F12, which is more host/environment-sensitive (can be intercepted as a global shortcut).
    // `preserveSelection` keeps the 8:15 cursor placed above — otherwise the palette's workbench
    // focus-click re-parks the cursor at end-of-document (below the last line of this 10-line file)
    // and Go to Definition resolves nothing.
    await goToDefinition(page, { preserveSelection: true });

    // PRIMARY: the VS Code status-bar selection item reports the cursor position. The Aura LS
    // resolves the def to the `simpleNewContact` name-attribute value range on L3
    // (`getAuraBindingTemplateDeclaration`); Go to Definition selects that range and places the
    // cursor at its END — status bar reads exactly `Ln 3, Col 27`.
    await expect(positionItem).toContainText(/Ln 3, Col 27/, { timeout: 15_000 });

    // SECONDARY (defense): aura1.cmp is still the active tab — confirms within-file nav (no spurious
    // new tab / peek editor).
    const auraTab = page.getByRole('tab', { name: /aura1\.cmp/ }).first();
    await expect(auraTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await saveScreenshot(page, 'auraLspGoToDefinition.container.04-go-to-definition.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
