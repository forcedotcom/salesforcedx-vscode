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
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, goToLineCol, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await assertWelcomeTabExists(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP Go to Definition navigates from JS to LightningElement type definition', async ({ page }) => {
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
    // Default template line 3: "export default class Lwc1 extends LightningElement {"
    // "LightningElement" starts at column 35; place cursor inside the word
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="gtdJsComp.js"]`);
    await editor.click();
    await goToLineCol(page, 3, 38);
  });

  await test.step('execute Go to Definition', async () => {
    await executeCommandWithCommandPalette(page, 'Go to Definition');
  });

  await test.step('verify navigation opened the LightningElement type definition', async () => {
    // The LWC base type definitions live in a file typically named "types.d.ts"
    const activeTab = page.locator(TAB).filter({ has: page.locator('[aria-selected="true"]') }).first();
    await expect(activeTab, 'Go to Definition should open the LightningElement type definition file').toContainText(
      'types.d.ts',
      { timeout: 15_000 }
    );
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
