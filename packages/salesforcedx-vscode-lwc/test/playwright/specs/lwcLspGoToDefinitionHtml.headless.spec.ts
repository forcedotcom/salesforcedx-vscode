/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  TAB,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, goToLineCol, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';
import { applyLwcWebScratchAuth } from '../utils/lwcWebScratchAuth';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await applyLwcWebScratchAuth(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP Go to Definition navigates from HTML property binding to JS class property', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create gtdHtmlComp via SFDX and open HTML (template patched after create)', async () => {
    await createLwc(page, 'gtdHtmlComp');
    await openLwcFile(page, 'gtdHtmlComp.html');
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await waitForLwcLspReady(page);
  });

  await test.step('position cursor on the {greeting} binding in the HTML template', async () => {
    // Patched HTML line 2: "    <p>{greeting}</p>" — place cursor on "greeting"
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="gtdHtmlComp.html"]`);
    await editor.click();
    await goToLineCol(page, 2, 10);
  });

  await test.step('execute Go to Definition', async () => {
    await executeCommandWithCommandPalette(page, 'Go to Definition');
  });

  await test.step('verify navigation targets gtdHtmlComp.js (class field location)', async () => {
    // Prefer a visible editor for the JS module; tab label is a fallback if the URI attribute differs (e.g. peek).
    const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri*="gtdHtmlComp.js"]`);
    const jsTab = page.locator(TAB).filter({ hasText: /gtdHtmlComp\.js/ });
    await expect(
      jsEditor.or(jsTab).first(),
      'Go to Definition should open the JS class member for the binding'
    ).toBeVisible({
      timeout: 15_000
    });
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
