/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Aura language server (ADR 0022). The desktop twin
 * (auraLspAutocompletion.desktop.spec.ts) proves `<aura:appl` completion runs in the Electron host;
 * this proves the same desktop-flavored Aura language server starts and answers inside the Code
 * Builder image, where the container Page is browser-flavored (`isDesktop()` FALSE) yet the Node
 * host runs the desktop server. No org and no seeding: `aura1.cmp` already exists in the mounted
 * fixture workspace at force-app/main/default/aura/aura1 with the load-bearing layout (L2 is a blank
 * tab line, `<aura:attribute name="simpleNewContact">` on L3, `{!v.simpleNewContact}` on L8), so we
 * open it and type at L2 C1.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToLineCol,
  openFileFromExplorerTree,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { waitForAuraLspReady } from '../../utils/auraLspUtils';

test('Aura LSP (Code Builder): autocompletion', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Scope to the suggest widget so other monaco lists (file picker, quick open) can't match
  // (lwcLspAutocompletion precedent). `.show-file-icons` further filters the completion rows.
  const completionRows = page.locator('.editor-widget.suggest-widget .monaco-list-row.show-file-icons');

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await clearAllNotifications(page);
    await saveScreenshot(page, 'auraLspAutocompletion.container.01-ready.png');
  });

  await test.step('open aura1.cmp and wait for indexing complete', async () => {
    await openFileFromExplorerTree(page, 'aura1.cmp', ['force-app', 'main', 'default', 'aura', 'aura1']);
    await waitForAuraLspReady(page);
    await saveScreenshot(page, 'auraLspAutocompletion.container.02-indexing-complete.png');
  });

  await test.step('type <aura:appl and select the aura:application completion', async () => {
    // L2 is the blank tab line per the committed fixture layout — load-bearing typing target.
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
    await saveScreenshot(page, 'auraLspAutocompletion.container.03-inserted.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
