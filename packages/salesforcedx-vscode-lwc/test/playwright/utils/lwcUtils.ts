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
  QUICK_INPUT_LIST_ROW,
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
import lwcPackageNls from '../../../package.nls.json';
import { LWC_GTD_HTML_COMP_SEED_HTML, LWC_GTD_HTML_COMP_SEED_JS } from './createLwcTestWorkspace';

/** Text shown in the LWC language status item when the LSP has finished indexing. */
const LWC_LSP_READY_TEXT = 'Indexing complete';

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
  await expect(page.locator(DIRTY_EDITOR).first(), 'editor should be saved (no dirty indicator)').not.toBeVisible({
    timeout: 10_000
  });
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
 * Expand a folder path in the Files Explorer.
 * Reused for LWC bundles under `force-app/.../lwc` and for `.sfdx/typings/lwc` generated typings.
 */
const expandWebExplorerSegments = async (page: Page, pathSegments: string[]): Promise<void> => {
  for (const segment of pathSegments) {
    const escaped = segment.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = page.getByRole('treeitem', { name: new RegExp(`^${escaped}(/|,|$)`) });
    await rows.first().waitFor({ state: 'attached', timeout: 15_000 });
    // Explorer re-renders rows (sticky scroll / virtualization); a locator can detach between wait and scroll.
    // Re-resolve the row each attempt via expect().toPass().
    await expect(async () => {
      const row = await pickNonStickyTreeItem(rows, `"${segment}"`);
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
 * LWC files sit under `force-app/main/default/lwc/<bundle>/`. Collapsed parents keep leaf rows out of the tree, so
 * expand the path before single-clicking a file.
 */
const expandExplorerPathToLwcFile = async (page: Page, fileName: string): Promise<void> => {
  const dot = fileName.lastIndexOf('.');
  const bundleDir = dot === -1 ? fileName : fileName.slice(0, dot);
  await expandWebExplorerSegments(page, ['force-app', 'main', 'default', 'lwc', bundleDir]);
};

/**
 * Single-click a leaf `treeitem` in web Files Explorer.
 * Accessible names are often `filename` or `filename, …` (description suffix); match `^name(,|$)` like folder rows.
 */
const clickWebExplorerTreeitemExact = async (page: Page, fileName: string): Promise<void> => {
  const escaped = fileName.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allTreeItems = page.getByRole('treeitem', { name: new RegExp(`^${escaped}(,|$)`, 'i') });
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
 * On VS Code for Web, Quick Open often omits files that exist in Explorer until that file has been opened once
 * from the tree (the file search index lags the Explorer view after SFDX create). Match manual workflow: single-click
 * the file in Files Explorer so the editor opens reliably in E2E.
 */
const openLwcFileViaExplorer = async (page: Page, fileName: string): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  await expandExplorerPathToLwcFile(page, fileName);
  await clickWebExplorerTreeitemExact(page, fileName);
};

/**
 * Opens a file in the editor.
 *
 * Single-click in Files Explorer after expanding `force-app/.../lwc/<bundle>/` — **Go to File…** often misses
 * newly created LWC files on both web and desktop until they are opened from the tree once.
 */
export const openLwcFile = async (page: Page, fileName: string): Promise<void> => {
  await openLwcFileViaExplorer(page, fileName);
  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${fileName}"]`);
  await editor.waitFor({ state: 'visible', timeout: 15_000 });
};

/**
 * Create bundles with **SFDX: Create Lightning Web Component** (same FS the UI uses), then open the `.js` editor.
 */
export const createLwcViaSfdxCommand = async (page: Page, componentName: string): Promise<void> => {
  const camelName = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
  const jsFileName = `${camelName}.js`;

  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  const createLwcCommand = lwcPackageNls.lightning_generate_lwc_text;
  // Same wizard steps as `salesforcedx-vscode-metadata` `lwcGenerateComponent.headless.spec.ts`.
  await verifyCommandExists(page, createLwcCommand, 120_000);
  await executeCommandWithCommandPalette(page, createLwcCommand);
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });

  // Step 1 (optional): Select component type (JavaScript / TypeScript) — newer extension versions skip this picker.
  const hasTypePicker = await quickInput
    .locator(QUICK_INPUT_LIST_ROW)
    .first()
    .waitFor({ state: 'visible', timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (hasTypePicker) {
    await page.keyboard.press('Enter');
  }

  // Step 2: Enter component name (SFDX: lowercase first letter, alphanumeric + underscores)
  await quickInput.getByText(/Enter Lightning Web Component name/i).waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type(camelName);
  await page.keyboard.press('Enter');

  // Step 3: Select output directory (default)
  await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 15_000 });
  await page.keyboard.press('Enter');

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
 * Creates a Lightning Web Component via **SFDX: Create Lightning Web Component**, then opens its `.js` editor.
 * Desktop and web use the same flow.
 */
export const createLwc = async (page: Page, componentName: string): Promise<void> => {
  await createLwcViaSfdxCommand(page, componentName);
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
 * Filenames and first-line markers copied into `.sfdx/typings/lwc/` by the LWC language server on SFDX workspace init.
 * Keep in sync with `writeTypings` in `@salesforce/salesforcedx-lightning-lsp-common` `baseContext.ts` and bundled
 * sources under `packages/salesforcedx-vscode-lwc/resources/sfdx/typings/`.
 */
const LWC_SFDX_GENERATED_TYPINGS_EXPECTATIONS = [
  { file: 'lds.d.ts', header: "declare module 'lightning/uiListApi'" },
  { file: 'messageservice.d.ts', header: "declare module 'lightning/messageService'" },
  { file: 'apex.d.ts', header: "declare module '@salesforce/apex'" },
  { file: 'engine.d.ts', header: "declare module 'lwc'" },
  { file: 'schema.d.ts', header: "declare module '@salesforce/schema'" }
] as const;

/** Open `.sfdx/indexes/lwc/custom-components.json` (LWC component index written by the language server). */
export const openSfdxCustomComponentsJson = async (page: Page): Promise<void> => {
  const fileName = 'custom-components.json';
  await (isDesktop()
    ? openFileByName(page, fileName)
    : expect(async () => {
        await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
        await expandWebExplorerSegments(page, ['.sfdx', 'indexes', 'lwc']);
        await clickWebExplorerTreeitemExact(page, fileName);
      }).toPass({ timeout: 90_000 }));
  await page.locator(`${EDITOR_WITH_URI}[data-uri*="${fileName}"]`).waitFor({ state: 'visible', timeout: 15_000 });
};

/**
 * After indexing, assert each generated `.d.ts` exists and still declares the expected module (guards empty/corrupt copies).
 */
export const assertLwcSfdxTypingsGenerated = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    for (const { file, header } of LWC_SFDX_GENERATED_TYPINGS_EXPECTATIONS) {
      await openFileByName(page, file);
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${file}"]`);
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await expect(editor.locator('.view-lines'), `generated typing ${file} should include ${header}`).toContainText(
        header,
        { timeout: 15_000 }
      );
    }
    return;
  }

  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  await expandWebExplorerSegments(page, ['.sfdx', 'typings', 'lwc']);
  for (const { file, header } of LWC_SFDX_GENERATED_TYPINGS_EXPECTATIONS) {
    await clickWebExplorerTreeitemExact(page, file);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${file}"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(editor.locator('.view-lines'), `generated typing ${file} should include ${header}`).toContainText(
      header,
      { timeout: 15_000 }
    );
  }
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
