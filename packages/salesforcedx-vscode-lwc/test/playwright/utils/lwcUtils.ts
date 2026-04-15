/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Locator, type Page } from '@playwright/test';
import {
  DIRTY_EDITOR,
  EDITOR_WITH_URI,
  QUICK_INPUT_WIDGET,
  STATUS_BAR_ITEM_LABEL,
  WORKBENCH,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  openFileByName,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { LWC_GTD_HTML_COMP_SEED_HTML, LWC_GTD_HTML_COMP_SEED_JS } from './createLwcTestWorkspace';

/** Text shown in the LWC language status item when the LSP has finished indexing. */
export const LWC_LSP_READY_TEXT = 'Indexing complete';

const replaceEditorContentAndSave = async (
  page: Page,
  editor: ReturnType<Page['locator']>,
  content: string
): Promise<void> => {
  await editor.click();
  await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });
  await executeCommandWithCommandPalette(page, 'Select All');
  await page.keyboard.press('Delete');
  await page.evaluate((t: string) => navigator.clipboard.writeText(t), content);
  await executeCommandWithCommandPalette(page, 'Paste');
  await executeCommandWithCommandPalette(page, 'File: Save');
  await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 10_000 });
};

const pickNonStickyTreeItem = async (items: Locator, description: string): Promise<Locator> => {
  const count = await items.count();
  if (count === 0) {
    throw new Error(`No Files Explorer tree item found for ${description}`);
  }
  for (let i = 0; i < count; i++) {
    const candidate = items.nth(i);
    const isSticky = await candidate.evaluate(el => el.classList.contains('monaco-tree-sticky-row'));
    if (!isSticky) {
      return candidate;
    }
  }
  // Explorer sticky scrolling can duplicate rows; every visible match may be sticky. Prefer the last row (same idea as
  // the multi-root `force-app` branch below) so expand/click still targets the real tree node.
  return items.nth(count - 1);
};

/**
 * Web / multi-root: LWC files sit under `force-app/main/default/lwc/<bundle>/`. Collapsed parents keep leaf rows out of
 * the tree, so expand the path before single-clicking a file (matches needing to “open” `force-app` in the UI).
 */
const expandWebExplorerPathToLwcFile = async (page: Page, fileName: string): Promise<void> => {
  const dot = fileName.lastIndexOf('.');
  const bundleDir = dot === -1 ? fileName : fileName.slice(0, dot);
  const segments = ['force-app', 'main', 'default', 'lwc', bundleDir];
  const mountRows = page.getByRole('treeitem', { name: /^mount(\/|,|$)/ });
  if ((await mountRows.count()) > 0) {
    segments.unshift('mount');
  }
  for (const segment of segments) {
    const escaped = segment.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = page.getByRole('treeitem', { name: new RegExp(`^${escaped}(/|,|$)`) });
    await rows.first().waitFor({ state: 'attached', timeout: 15_000 });
    // Explorer re-renders rows (sticky scroll / virtualization); a locator can detach between wait and scroll.
    // Re-resolve the row each attempt via expect().toPass().
    await expect(async () => {
      const rowCount = await rows.count();
      let row: Locator;
      if (segment === 'force-app' && segments[0] === 'mount' && rowCount > 1) {
        const last = rows.nth(rowCount - 1);
        row = (await last.evaluate(el => el.classList.contains('monaco-tree-sticky-row')))
          ? await pickNonStickyTreeItem(rows, `"${segment}"`)
          : last;
      } else {
        row = await pickNonStickyTreeItem(rows, `"${segment}"`);
      }
      await row.waitFor({ state: 'visible', timeout: 10_000 });
      await row.scrollIntoViewIfNeeded();
      const expanded = await row.getAttribute('aria-expanded');
      if (expanded !== 'true') {
        const twistie = row.locator('.monaco-tl-twistie').first();
        const twistieCount = await twistie.count();
        await (twistieCount > 0 ? twistie.click() : row.click());
      }
      await expect(row).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }
};

/**
 * On VS Code for Web, Quick Open often omits files that exist in Explorer until that file has been opened once
 * from the tree (the file search index lags the Explorer view after SFDX create). Match manual workflow: single-click
 * the file in Files Explorer so the editor opens reliably in E2E.
 */
const openLwcFileViaExplorerSingleClick = async (page: Page, fileName: string): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  await expandWebExplorerPathToLwcFile(page, fileName);
  const allTreeItems = page.getByRole('treeitem', { name: fileName, exact: true });
  await allTreeItems.first().waitFor({ state: 'attached', timeout: 15_000 });
  await expect(async () => {
    const n = await allTreeItems.count();
    if (n === 0) {
      throw new Error(`No Files Explorer tree item found for "${fileName}"`);
    }
    let toClick: Locator | undefined;
    for (let i = 0; i < n; i++) {
      const candidate = allTreeItems.nth(i);
      const isSticky = await candidate.evaluate(el => el.classList.contains('monaco-tree-sticky-row'));
      if (!isSticky) {
        toClick = candidate;
        break;
      }
    }
    const row = toClick ?? allTreeItems.nth(n - 1);
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.scrollIntoViewIfNeeded();
    await row.click({ timeout: 5000 });
  }).toPass({ timeout: 45_000 });
};

/**
 * Opens a file in the editor.
 *
 * **Desktop:** **Go to File…** via `openFileByName`.
 * **Web:** Single-click in Files Explorer (see `openLwcFileViaExplorerSingleClick`) — Quick Open is unreliable for
 * newly created LWC siblings until they have been opened from Explorer once.
 */
export const openLwcFile = async (page: Page, fileName: string): Promise<void> => {
  await (isDesktop() ? openFileByName(page, fileName) : openLwcFileViaExplorerSingleClick(page, fileName));
  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${fileName}"]`);
  await editor.waitFor({ state: 'visible', timeout: 15_000 });
};

/**
 * Web: VS Code test-web “Test Files” workspace often does not surface Node-pre-seeded nested files in Explorer.
 * Create bundles with **SFDX: Create Lightning Web Component** (same FS the UI uses), then open the `.js` editor.
 */
const createLwcViaSfdxCommandWeb = async (page: Page, componentName: string): Promise<void> => {
  const camelName = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
  const jsFileName = `${camelName}.js`;

  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  await verifyCommandExists(page, 'SFDX: Create Lightning Web Component', 90_000);
  await executeCommandWithCommandPalette(page, 'SFDX: Create Lightning Web Component');

  const widget = page.locator(QUICK_INPUT_WIDGET);
  await widget.waitFor({ state: 'visible', timeout: 15_000 });

  // `createLwcCommand` only skips this when `defaultLwcLanguage` is read from sfdx-project.json; web E2E often still shows it first.
  // Do not rely on getByText("Select component type") — VS Code often exposes that string only as the input placeholder, so it is not matched as visible text.
  const javaScriptTypeOption = widget.getByRole('option', { name: /^JavaScript$/i }).first();
  if (await javaScriptTypeOption.isVisible({ timeout: 8000 }).catch(() => false)) {
    await javaScriptTypeOption.click();
  }

  // Metadata flow: "Enter Lightning Web Component name". Core internal (rare): "Enter desired filename".
  await widget
    .getByText(/Enter desired filename|Enter Lightning Web Component name/i)
    .waitFor({ state: 'visible', timeout: 15_000 });
  const nameInput = widget.locator('input.input');
  await nameInput.click({ timeout: 5000 });
  // Metadata `createLwcCommand` validates `^[a-z][A-Za-z0-9_]*$` (camelCase); PascalCase is rejected.
  await page.keyboard.type(camelName);
  await page.keyboard.press('Enter');

  await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 15_000 });
  await page.keyboard.press('Enter');

  await page.waitForTimeout(400);
  const jsOption = page.getByRole('option', { name: /^JavaScript$/i }).first();
  if (await jsOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await jsOption.click();
  }

  const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${jsFileName}"]`);
  await jsEditor.waitFor({ state: 'visible', timeout: 45_000 });

  if (componentName === 'gtdHtmlComp') {
    await replaceEditorContentAndSave(page, jsEditor, LWC_GTD_HTML_COMP_SEED_JS);
    await openLwcFile(page, `${camelName}.html`);
    const htmlEditor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${camelName}.html"]`);
    await htmlEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await replaceEditorContentAndSave(page, htmlEditor, LWC_GTD_HTML_COMP_SEED_HTML);
    await openLwcFile(page, jsFileName);
    await jsEditor.waitFor({ state: 'visible', timeout: 10_000 });
  }
};

/**
 * Opens a pre-created Lightning Web Component's JS file in the editor.
 *
 * **Desktop:** workspace bundles are pre-seeded on disk → `openFileByName`.
 * **Web:** empty playground + **SFDX: Create Lightning Web Component** for this bundle (see `createLwcWebPlaygroundWorkspace`).
 */
export const createLwc = async (page: Page, componentName: string): Promise<void> => {
  if (isDesktop()) {
    const camelName = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
    const jsFileName = `${camelName}.js`;
    await closeWelcomeTabs(page);
    await openFileByName(page, jsFileName);
    const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${jsFileName}"]`);
    await jsEditor.waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }

  await createLwcViaSfdxCommandWeb(page, componentName);
};

/**
 * Waits for the LWC Language Server to finish indexing files.
 * `createLanguageStatusItem` surfaces as the **Editor Language Status** control (status bar button), not `.statusbar-item-label`.
 * Keep a fallback on the legacy label selector for older layouts.
 */
export const waitForLwcLspReady = async (page: Page, timeout = 90_000): Promise<void> => {
  const editorLanguageStatus = page.locator(WORKBENCH).getByRole('button', { name: new RegExp(LWC_LSP_READY_TEXT) });
  const legacyStatusBarLabel = page.locator(STATUS_BAR_ITEM_LABEL).filter({ hasText: LWC_LSP_READY_TEXT });
  await expect(
    editorLanguageStatus.or(legacyStatusBarLabel).first(),
    `LWC LSP should show "${LWC_LSP_READY_TEXT}" when indexing is done`
  ).toBeVisible({ timeout });
};

/**
 * Moves the editor cursor to a specific line and column using the Go to Line/Column command.
 * Line and column are both 1-indexed.
 */
export const goToLineCol = async (page: Page, line: number, col: number): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Go to Line/Column...');
  const widget = page.locator(QUICK_INPUT_WIDGET);
  await widget.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.type(`${line}:${col}`);
  await page.keyboard.press('Enter');
  await widget.waitFor({ state: 'hidden', timeout: 5000 });
};

/** Moves the cursor to the last line (VS Code clamps the line number to the file length). */
export const goToEndOfFile = async (page: Page): Promise<void> => {
  await goToLineCol(page, 99_999, 1);
};
