/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  focusOnFilesExplorer,
  focusOnProblemsView,
  goToFile,
  goToLineColumn,
  newUntitledTextFile,
  paste,
  reloadWindow,
  saveFile,
  selectAll,
  showExplorer
} from '../../../src/pages/nativeCommands';
import { openFileByName } from '../../../src/utils/fileHelpers';
import { waitForVSCodeWorkbench, closeWelcomeTabs, isDesktop } from '../../../src/utils/helpers';
import { EDITOR_WITH_URI, QUICK_INPUT_WIDGET, TAB, WORKBENCH } from '../../../src/utils/locators';
import { ensureSecondarySideBarHidden } from '../../../src/utils/workflows';
import { test } from '../fixtures/index';

// Coverage scope: the 11 WI-named native wrappers + `focusOnProblemsView`, all exercisable headlessly.
// Wrappers that need a desktop context or an extension (`goToDefinition` LSP nav,
// `showRunningExtensions`, `hideSecondarySideBar`, `closeWorkspace`, `closeEditor`, `find`,
// `hidePanel`, `clearOutput`, `insertSnippet`, `focusActiveEditorGroup`) are NOT here — they
// remain covered by their owning specs (apex/lwc/lightning/visualforce LSP + snippet/soql specs).

const PROBLEMS_VIEW = '[id="workbench.panel.markers"]';
const NON_WELCOME_TAB = `${TAB}:not(:has-text("Welcome")):not(:has-text("Walkthrough"))`;

test.describe('Native command wrappers', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  test('focusOnFilesExplorer focuses the Files Explorer view', async ({ page }) => {
    await focusOnFilesExplorer(page);
    await expect(page.getByRole('tree', { name: /Files Explorer/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('newUntitledTextFile opens a new untitled editor', async ({ page }) => {
    await newUntitledTextFile(page);
    await expect(page.locator(TAB).filter({ hasText: /Untitled-\d+/ })).toBeVisible({ timeout: 10_000 });
  });

  test('saveFile clears the dirty indicator', async ({ page }) => {
    // `File: Save` only writes a backed file. An untitled doc has no path, so Save opens a
    // (never-handled) save-as dialog and the tab stays dirty — open a real workspace file instead.
    // Web Quick Open can't find files that were never opened in the editor, so this is desktop-only —
    // same reason commandPalette.headless.spec.ts skips its File: Save assertion off desktop.
    test.skip(!isDesktop(), 'Saving requires a real on-disk file (desktop only)');

    // sfdx-project.json is scaffolded into every desktop workspace by createTestWorkspace.
    await openFileByName(page, 'sfdx-project.json');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    // Append a blank line so the doc is dirty without breaking JSON (nothing reads it after).
    await goToLineColumn(page);
    await page.keyboard.type('1:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('\n');
    // The unsaved-changes marker lives on the editor tab (`.tab.dirty`), not the editor body.
    const dirtyTab = page.locator(`${WORKBENCH} .tabs-container .tab.dirty`);
    await expect(dirtyTab).toBeVisible({ timeout: 10_000 });

    await saveFile(page);
    await expect(dirtyTab).not.toBeVisible({ timeout: 10_000 });
  });

  test('clearAllNotifications leaves no notification toasts', async ({ page }) => {
    // The wrapper is idempotent: with no toasts it is a no-op, with toasts present it dismisses
    // them. Either way the observable post-condition is zero notification list items.
    await clearAllNotifications(page);
    await expect(page.locator(`${WORKBENCH} .notification-list-item`)).toHaveCount(0, { timeout: 10_000 });
  });

  test('closeAllEditors closes all non-welcome editor tabs', async ({ page }) => {
    await newUntitledTextFile(page);
    await expect(page.locator(NON_WELCOME_TAB)).not.toHaveCount(0, { timeout: 10_000 });

    await closeAllEditors(page);
    await expect(page.locator(NON_WELCOME_TAB)).toHaveCount(0, { timeout: 10_000 });
  });

  test('showExplorer reveals the Explorer sidebar', async ({ page }) => {
    await showExplorer(page);
    await expect(page.getByRole('tree', { name: /Files Explorer/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('reloadWindow reloads the workbench', async ({ page }) => {
    await reloadWindow(page);
    // After reload the workbench re-initializes; waiting for it again proves the command took effect.
    await waitForVSCodeWorkbench(page);
    await expect(page.locator(WORKBENCH)).toBeVisible({ timeout: 30_000 });
  });

  test('goToFile opens the Quick Open file picker', async ({ page }) => {
    await goToFile(page);
    const widget = page.locator(QUICK_INPUT_WIDGET);
    await expect(widget).toBeVisible({ timeout: 10_000 });
    // Quick Open file picker leaves the input empty (no leading ">" command prefix).
    await expect(widget.locator('input.input')).toHaveValue('', { timeout: 5000 });
  });

  test('goToLineColumn moves the cursor to the target line/column', async ({ page }) => {
    await newUntitledTextFile(page);
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await page.keyboard.type('line one\nline two\nline three');

    await goToLineColumn(page);
    await page.keyboard.type('2:3');
    await page.keyboard.press('Enter');

    // Status bar reflects the cursor position as "Ln 2, Col 3".
    await expect(page.locator(`${WORKBENCH} .statusbar-item`).filter({ hasText: /Ln 2, Col 3/ })).toBeVisible({
      timeout: 10_000
    });
  });

  test('selectAll selects the entire document', async ({ page }) => {
    await newUntitledTextFile(page);
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await page.keyboard.type('alpha beta gamma');

    await selectAll(page);
    // Replacing the selection with a single character proves the whole document was selected.
    await page.keyboard.type('X');
    await expect(editor).toContainText('X');
    await expect(editor).not.toContainText('alpha');
  });

  test('paste inserts clipboard content at the cursor', async ({ page }) => {
    await newUntitledTextFile(page);
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();

    // Web headless: clipboard is per-browser-context (not the shared OS clipboard), so writing then
    // pasting within this single test does not race other workers.
    const clipboardText = 'pasted-via-wrapper';
    await page.evaluate((text: string) => navigator.clipboard.writeText(text), clipboardText);

    await paste(page);
    await expect(editor).toContainText(clipboardText, { timeout: 10_000 });
  });

  test('focusOnProblemsView reveals the Problems view', async ({ page }) => {
    await focusOnProblemsView(page);
    await expect(page.locator(PROBLEMS_VIEW)).toBeVisible({ timeout: 10_000 });
  });
});
