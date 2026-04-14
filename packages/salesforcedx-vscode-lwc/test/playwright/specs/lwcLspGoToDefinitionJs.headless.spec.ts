/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Web (`npm run test:web`): the spec below is skipped. VS Code for Web runs the TS/JS language service on a virtual
 * filesystem (e.g. memfs); project-wide analysis is often "partial" until fully loaded, and path resolution differs
 * from desktop `file://`. Navigating from LWC `.js` to extension typings (`engine.d.ts`) via Go to Type Definition is
 * unreliable in headless web E2E even though typings exist in both hosts. Desktop matches typical local DX; see
 * https://github.com/microsoft/vscode/pull/169311 (cross-file TS on web) and memfs handling in
 * `salesforcedx-lwc-language-server` `componentIndexer`.
 */
import { expect } from '@playwright/test';
import {
  EDITOR,
  EDITOR_WITH_URI,
  TAB,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, goToLineCol, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';
import { applyLwcWebScratchAuth } from '../utils/lwcWebScratchAuth';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await assertWelcomeTabExists(page);
  await closeWelcomeTabs(page);
  await applyLwcWebScratchAuth(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP Go to Type Definition navigates from JS to LightningElement declaration', async ({ page }) => {
  test.skip(!isDesktop(), 'Desktop only — see file comment: web TS/navigation to typings is not stable for this E2E');

  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, 'gtdJsComp');
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    // Open the HTML file first so the status item appears, then switch back to JS
    await openLwcFile(page, 'gtdJsComp.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'gtdJsComp.js');
  });

  await test.step('position cursor on "LightningElement" in the extends clause', async () => {
    // Default SFDX template line 3: `export default class GtdJsComp extends LightningElement {`
    // Place the caret on the `LightningElement` identifier (column 40 = `L`).
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="gtdJsComp.js"]`);
    await editor.click();
    await goToLineCol(page, 3, 40);
  });

  await test.step('execute Go to Type Definition', async () => {
    // **Go to Definition** often jumps to the import line first (`import { LightningElement } from 'lwc'`) because TS
    // resolves the symbol to that binding. **Go to Type Definition** targets the declared class in typings (.d.ts).
    await executeCommandWithCommandPalette(page, 'Go to Type Definition');
  });

  await test.step('verify navigation opened the LightningElement declaration', async () => {
    // Resolution target is usually extension typings (engine.d.ts under resources/sfdx/typings). URIs vary by host
    // (file:, vscode-file:, virtual); TS may also use Peek instead of a new tab. Assert on URI hints and/or the
    // definitive declaration line from engine.d.ts (not present in user LWC sources).
    const byUri = page
      .locator(`${EDITOR_WITH_URI}[data-uri*="engine.d.ts"]`)
      .or(page.locator(`${EDITOR_WITH_URI}[data-uri*="types.d.ts"]`))
      .or(page.locator(`${EDITOR_WITH_URI}[data-uri*="typings"]`))
      .or(page.locator(TAB).filter({ hasText: /engine\.d\.ts|types\.d\.ts/i }));
    const byDeclaration = page.locator(EDITOR_WITH_URI).filter({ hasText: /export class LightningElement\b/ });
    const peekDeclaration = page
      .locator('.peekview-widget')
      .locator(EDITOR)
      .filter({ hasText: /export class LightningElement\b/ });
    await expect(
      byUri.or(byDeclaration).or(peekDeclaration).first(),
      'Go to Type Definition should surface LightningElement typings'
    ).toBeVisible({
      timeout: 30_000
    });
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
