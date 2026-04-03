/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  QUICK_INPUT_WIDGET,
  STATUS_BAR_ITEM_LABEL,
  executeCommandWithCommandPalette
} from '@salesforce/playwright-vscode-ext';

/** Text shown in the LWC language status item when the LSP has finished indexing. */
export const LWC_LSP_READY_TEXT = 'Indexing complete';

/**
 * Opens a pre-created Lightning Web Component's JS file in the editor.
 *
 * Components are pre-created on disk by the headless server (`headlessServer.ts`) so tests
 * do not depend on the "SFDX: Create Lightning Web Component" command (which is unreliable
 * in VS Code web because @salesforce/templates writes to memfs, not the virtual workspace FS).
 *
 * VS Code web opens the default "Code Builder" workspace and adds our project as a second
 * root workspace folder named `mount` (aria-level=1). This helper uses keyboard navigation
 * in the Explorer tree to expand the folder hierarchy and open the component's JS file,
 * avoiding coordinate-based clicks that are unreliable on Monaco List's virtual DOM.
 *
 * Navigation plan (after collapsing all folders to a known state):
 * 1. End → mount → ArrowRight×2 → force-app → main → default → lwc → component → .js file
 */
export const createLwc = async (page: Page, componentName: string): Promise<void> => {
  // @salesforce/templates camelCases the component name (e.g. MyComp → myComp)
  const camelName = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
  const jsFileName = `${camelName}.js`;

  await executeCommandWithCommandPalette(page, 'View: Show Explorer');

  // The Welcome tab renders in a sandboxed iframe. When keyboard events are sent while that
  // iframe has DOM focus, they never reach VS Code's global keybinding system (so Ctrl+Shift+E
  // can't focus the Explorer). Click the Explorer heading — a native element in the main frame —
  // to break out of the iframe focus, then use Ctrl+Shift+E to tell VS Code's workbench to
  // route keyboard input to the file tree.
  const explorerHeading = page.getByRole('heading', { name: 'Explorer', level: 2 });
  await explorerHeading.waitFor({ state: 'visible', timeout: 5000 });
  await explorerHeading.click();
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+Shift+E');
  await page.waitForTimeout(300);

  // Known initial state (observed consistently across all test runs):
  //   Code Builder [expanded, 12 children] + mount [expanded, 2 children (force-app + sfdx-project.json)]
  //   → 16 total visible items
  //   `End` → last visible item = mount/sfdx-project.json (index 15)
  //   `ArrowUp` → mount/force-app (index 14)
  await page.keyboard.press('End');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);

  /**
   * Expand the currently focused folder (ArrowRight when collapsed = expand in place)
   * then move into its first child (second ArrowRight = descend).
   */
  const expandIntoFirstChild = async () => {
    await page.keyboard.press('ArrowRight'); // expand (folder must be collapsed)
    await page.waitForTimeout(400); // wait for tree to re-render children
    await page.keyboard.press('ArrowRight'); // move focus to first child
    await page.waitForTimeout(200);
  };

  // Expand each folder and descend into its first child
  await expandIntoFirstChild(); // force-app → main
  await expandIntoFirstChild(); // main → default
  await expandIntoFirstChild(); // default → lwc
  await expandIntoFirstChild(); // lwc → first component (autoComp, alphabetically)

  // The LWC components are sorted alphabetically; navigate down to the target
  const sortedComponents = ['autoComp', 'gtdHtmlComp', 'gtdJsComp', 'indexComp'];
  const componentIndex = sortedComponents.indexOf(camelName);
  for (let i = 0; i < componentIndex; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
  }

  // Expand the component folder, move to first child (.html alphabetically)
  await page.keyboard.press('ArrowRight'); // expand component folder
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight'); // move to first child: camelName.html
  await page.waitForTimeout(200);

  // Files inside the component: camelName.html, camelName.js, camelName.js-meta.xml (alphabetical)
  // One ArrowDown takes us from .html → .js
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);

  // Open the JS file with Enter (single-press opens it in the editor)
  await page.keyboard.press('Enter');

  const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${jsFileName}"]`);
  await jsEditor.waitFor({ state: 'visible', timeout: 15_000 });
};

/**
 * Waits for the LWC Language Server to finish indexing files.
 * The LSP status item shows "Indexing complete" in the status bar when ready.
 * Must be called with an LWC HTML or JS file active in the editor so the status item is visible.
 */
export const waitForLwcLspReady = async (page: Page, timeout = 90_000): Promise<void> => {
  // The LwcLspStatusBarItem uses languages.createLanguageStatusItem which renders in the status bar.
  // It shows the text defined in lwc_language_server_loaded i18n key once indexing is complete.
  const statusBarItem = page.locator(STATUS_BAR_ITEM_LABEL).filter({ hasText: LWC_LSP_READY_TEXT });
  await expect(statusBarItem, `LWC LSP should show "${LWC_LSP_READY_TEXT}" in status bar`).toBeVisible({ timeout });
};

/**
 * Opens a file by clicking its entry in the Explorer sidebar.
 *
 * VS Code web's "Go to File" (Ctrl+P) only searches files that have already been opened in the
 * editor — it cannot search the full workspace filesystem. The Explorer sidebar, however, always
 * reflects the complete workspace tree. After `createLwc` runs, VS Code reveals the created JS
 * file in the Explorer, so the parent folder is already expanded and sibling files (e.g. the HTML
 * file) are immediately visible as tree items.
 */
export const openLwcFile = async (page: Page, fileName: string): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'View: Show Explorer');

  // The treeitem's accessible name is the bare filename in the Explorer panel
  const treeItem = page.getByRole('treeitem', { name: fileName }).first();
  await expect(treeItem, `Explorer should show "${fileName}" in the file tree`).toBeVisible({ timeout: 15_000 });

  // Double-click to open in a permanent tab (single-click opens preview mode)
  await treeItem.dblclick();

  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${fileName}"]`);
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
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
