/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  DIRTY_EDITOR,
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

test('LWC LSP Go to Definition navigates from HTML property binding to JS class property', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, 'lwc1');
  });

  await test.step('add a tracked property to lwc1.js', async () => {
    // Modify the JS file to expose a "greeting" property so the HTML template can reference it.
    // The file opens automatically after creation; add the property on the line before the closing brace.
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="lwc1.js"]`);
    await editor.click();

    // Move to the end of the file and insert the property before the closing brace
    await executeCommandWithCommandPalette(page, 'Go to Last Line');
    await page.keyboard.press('ArrowUp'); // move above closing brace
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type("    greeting = 'Hello, World!';");

    await executeCommandWithCommandPalette(page, 'File: Save');
    await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });
  });

  await test.step('add {greeting} binding to lwc1.html', async () => {
    await openLwcFile(page, 'lwc1.html');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="lwc1.html"]`);
    await editor.click();

    // Replace the empty template body with a paragraph that binds the greeting property
    await executeCommandWithCommandPalette(page, 'Select All');
    await page.keyboard.press('Delete');
    await page.evaluate(
      (text: string) => navigator.clipboard.writeText(text),
      '<template>\n    <p>{greeting}</p>\n</template>\n'
    );
    await executeCommandWithCommandPalette(page, 'Paste');

    await executeCommandWithCommandPalette(page, 'File: Save');
    await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await waitForLwcLspReady(page);
  });

  await test.step('position cursor on the {greeting} binding in the HTML template', async () => {
    // After editing: line 2 is "    <p>{greeting}</p>"
    // "greeting" starts at column 9 (4-space indent + "<p>{" = 8, then "g" at 9)
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="lwc1.html"]`);
    await editor.click();
    await goToLineCol(page, 2, 10);
  });

  await test.step('execute Go to Definition', async () => {
    await executeCommandWithCommandPalette(page, 'Go to Definition');
  });

  await test.step('verify navigation opened lwc1.js (where the greeting property is defined)', async () => {
    const activeTab = page.locator(TAB).filter({ has: page.locator('[aria-selected="true"]') }).first();
    await expect(activeTab, 'Go to Definition should navigate to the JS file containing the property').toContainText(
      'lwc1.js',
      { timeout: 15_000 }
    );
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
