/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  executeCommandWithCommandPalette,
  openFileByName,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';

import { snippetTest as test } from '../fixtures';

/** Monaco may use NBSP; snippets can be one line or multiline — collapse for assertions. */
const collapseEditorWhitespace = (text: string): string =>
  text.replaceAll('\u00a0', ' ').replaceAll(/\s+/g, ' ').trim();

const readActiveEditorDocumentText = async (page: Page): Promise<string> => {
  const viewLines = page.locator(EDITOR_WITH_URI).first().locator('.view-lines').first();
  await viewLines.waitFor({ state: 'visible', timeout: 10_000 });
  const raw = await viewLines.textContent();
  return raw ?? '';
};

/** Close suggest widget / snippet tab-stop UI so it is not merged into editor text reads. */
const dismissEditorOverlays = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page
    .locator('.suggest-widget')
    .waitFor({ state: 'hidden', timeout: 3000 })
    .catch(() => {});
};

test('Apex snippets: Insert Snippet applies System Debug in .cls', async ({ page }) => {
  // timeout comes from playwright.config.desktop.ts (timeout: 360_000)
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for Salesforce project workspace + marketplace ext', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await waitForWorkspaceReady(page);
    // salesforce.apex-language-server-extension (marketplace) ships apex.json snippets; wait until
    // no extension shows "Activating" so the snippet contribution is registered before insertion.
    await waitForExtensionsActivated(page);
    await saveScreenshot(page, 'apex-snippets.workspace-ready.png');
  });

  await test.step('open ExampleClassTest.cls and position cursor on blank line 7', async () => {
    // ExampleClassTest.cls is pre-seeded (fixtures/desktopFixtures.ts) with a blank line 7 —
    // the deterministic snippet insertion target.
    await openFileByName(page, 'ExampleClassTest.cls');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    // Snippets are scoped to the active editor language; ensure the .cls editor (apex) has focus.
    await editor.click();
    // Move the cursor to the blank line 7 so `System.debug()` lands in a known location.
    await executeCommandWithCommandPalette(page, 'Go to Line/Column...');
    await page.keyboard.type('7:1');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'apex-snippets.editor-open.png');
  });

  await test.step('insert System Debug snippet', async () => {
    await executeCommandWithCommandPalette(page, 'Snippets: Insert Snippet');
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    // apex.json picker label = JSON key `System Debug`; prefix `debug` matches the fill.
    await quickInput.locator('input.input').first().fill('debug');
    await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await quickInput.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    await dismissEditorOverlays(page);
    await saveScreenshot(page, 'apex-snippets.after-insert.png');
  });

  await test.step('save and assert snippet body', async () => {
    await dismissEditorOverlays(page);
    await executeCommandWithCommandPalette(page, 'File: Save');
    // body `System.debug($0)`; `$0` is the final cursor (empty render) → saved text `System.debug()`.
    const doc = collapseEditorWhitespace(await readActiveEditorDocumentText(page));
    expect(doc).toContain('System.debug()');
    await saveScreenshot(page, 'apex-snippets.saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
