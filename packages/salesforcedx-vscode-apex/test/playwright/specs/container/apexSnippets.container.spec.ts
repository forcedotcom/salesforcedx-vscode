/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the desktop Apex snippets twin (apexSnippets.desktop.spec.ts), per ADR 0022.
 * The desktop twin proves "Insert Snippet" applies the `System Debug` apex.json snippet in a `.cls`
 * file in Electron; this proves the SAME insertion works inside the Code Builder image, where the
 * workbench is served to a browser Page but the extensions run in the Node host.
 *
 * The desktop twin injects the marketplace `salesforce.apex-language-server-extension` (which ships
 * the apex.json snippet contribution) via a dedicated fixture. The Code Builder image installs the
 * full Salesforce extension set, so the snippet contribution is already present — no marketplace
 * install step is needed here.
 *
 * No org setup and no file seeding: the container boots with one authed org already and
 * ExampleClassTest.cls already exists in the bind-mounted fixture with the same blank-line-7 layout
 * the twin seeds. We open it instead of writing it.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToLineCol,
  insertSnippet,
  openFileFromExplorerTree,
  QUICK_INPUT_WIDGET,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';

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

test('Apex snippets (Code Builder): Insert Snippet applies System Debug in .cls', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    // Wait until no extension shows "Activating" so the apex.json snippet contribution is
    // registered before insertion.
    await waitForExtensionsActivated(page);
    await saveScreenshot(page, 'apexSnippets.container.01-ready.png');
  });

  await test.step('open ExampleClassTest.cls and position cursor on blank line 7', async () => {
    // ExampleClassTest.cls is bind-mounted with a blank line 7 — the deterministic snippet insertion
    // target.
    await openFileFromExplorerTree(page, 'ExampleClassTest.cls', ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    // Snippets are scoped to the active editor language; ensure the .cls editor (apex) has focus.
    await editor.click();
    // Move the cursor to the blank line 7 so `System.debug()` lands in a known location.
    // goToLineCol waits for the Go to Line widget to open before typing and to close after
    // Enter — the raw type/press sequence raced the widget and left the caret at EOF, so the
    // snippet landed after the class-closing brace.
    await goToLineCol(page, 7, 1);
    await saveScreenshot(page, 'apexSnippets.container.02-editor-open.png');
  });

  await test.step('insert System Debug snippet', async () => {
    // preserveSelection: true skips openCommandPalette's workbench focus-click. The seeded file is
    // only 9 lines in a tall editor pane, so that click lands in the empty area below the last line
    // and moves the caret to EOF — the snippet then inserts after the class-closing brace instead
    // of on blank line 7. goToLineCol already gave the editor keyboard focus, so skipping the click
    // keeps the caret on line 7.
    await insertSnippet(page, {
      preserveSelection: true
    });
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    // apex.json picker label = JSON key `System Debug`; prefix `debug` matches the fill.
    await quickInput.locator('input.input').first().fill('debug');
    await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await quickInput.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    await dismissEditorOverlays(page);
    await saveScreenshot(page, 'apexSnippets.container.03-after-insert.png');
  });

  await test.step('save and assert snippet body', async () => {
    await dismissEditorOverlays(page);
    await saveFile(page);
    // body `System.debug($0)`; `$0` is the final cursor (empty render) → saved text `System.debug()`.
    // Assert it landed on blank line 7 (between the assertEquals and the class-closing brace) so a
    // misfired Go to Line/Column navigation cannot silently pass on a line-agnostic substring match.
    const doc = collapseEditorWhitespace(await readActiveEditorDocumentText(page));
    expect(doc).toMatch(/SayHello should greet the name'\);\s*System\.debug\(\)\s*}/);
    await saveScreenshot(page, 'apexSnippets.container.04-saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
