/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  DIRTY_EDITOR,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeExplorerContextMenuCommand,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';

// Single cross-platform source of truth for Visualforce LSP completion on `.page`.
// Runs on desktop (playwright.config.desktop.ts globs specs/) AND web (playwright.config.web.ts) —
// the `../fixtures` index resolves `test` to the desktop or web fixture by VSCODE_DESKTOP.

/**
 * Seed an empty `.page` in `force-app` via the Explorer "New File..." action (uses `workspace.fs`:
 * disk on desktop, memfs on web) and open it. Opening a `.page` triggers the extension's
 * `onLanguage:visualforce` activation and starts the language server — the spike's core assertion.
 */
const seedAndOpenPage = async (page: Page, name: string): Promise<void> => {
  await executeExplorerContextMenuCommand(page, /force-app/, /New File\.\.\./);

  // Inline input box in the Explorer tree: type the filename and confirm.
  await page.keyboard.type(`${name}.page`);
  await page.keyboard.press('Enter');

  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.page"]`);
  await editor.waitFor({ state: 'visible', timeout: 30_000 });
  await editor.click();
};

test.describe('Visualforce LSP', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  test('provides autocompletion for apex tags in .page files', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const name = `LspPage${Date.now()}`;
    const suggestWidget = page.locator('.suggest-widget');
    const suggestions = suggestWidget.locator('.monaco-list-row');

    await test.step('seed and open a .page file', async () => {
      await seedAndOpenPage(page, name);
    });

    await test.step('type a partial apex tag and trigger IntelliSense', async () => {
      // Explicitly trigger IntelliSense (the LSP may still be initializing).
      await page.keyboard.type('<apex:pageM');
      await page.keyboard.press('Control+Space');
      await suggestWidget.waitFor({ state: 'visible', timeout: 30_000 });
    });

    await test.step('assert apex:pageMessage is suggested', async () => {
      await suggestions.first().waitFor({ state: 'visible', timeout: 10_000 });
      const suggestionTexts = await suggestions.allTextContents();
      const hasPageMessage = suggestionTexts.some(t => t.toLowerCase().includes('apex:pagemessage'));
      expect(
        hasPageMessage,
        `Expected "apex:pageMessage" in suggestions, got: ${suggestionTexts.slice(0, 5).join(' | ')}`
      ).toBe(true);
      await saveScreenshot(page, 'vf-lsp-autocompletion.suggestions.png');
    });

    await test.step('accept the completion and save', async () => {
      const pageMessageRow = suggestions.filter({ hasText: /apex:pageMessage/i }).first();
      await pageMessageRow.click();
      await saveFile(page);
      await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 10_000 });
    });

    await test.step('assert the inserted tag lands in the editor buffer', async () => {
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.page"]`);
      await expect(editor.locator('.view-lines')).toContainText('apex:pageMessage', { timeout: 10_000 });
      await saveScreenshot(page, 'vf-lsp-autocompletion.inserted.png');
    });
  });

  // TODO: Go to Definition is not implemented in the Visualforce language server — documented gap carried over
  // from the deleted visualforceLsp.desktop.spec.ts. Add a spec here when the LS gains definition support.

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
