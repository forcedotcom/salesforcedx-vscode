/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  STATUS_BAR_ITEM_LABEL,
  executeCommandWithCommandPalette,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';

/** Text shown in the LWC language status item when the LSP has finished indexing. */
export const LWC_LSP_READY_TEXT = 'Indexing complete';

/**
 * Creates a Lightning Web Component named `componentName` using the SFDX: Create
 * Lightning Web Component command, accepting the default template and output directory.
 * Waits for the component's JS file to open in the editor before returning.
 */
export const createLwc = async (page: Page, componentName: string): Promise<void> => {
  await verifyCommandExists(page, 'SFDX: Create Lightning Web Component', 30_000);
  await executeCommandWithCommandPalette(page, 'SFDX: Create Lightning Web Component');

  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // Select the default template
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Enter');

  // Type the component name
  await quickInput.getByText(/Enter Lightning Web Component name/i).waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type(componentName);
  await page.keyboard.press('Enter');

  // Accept the default output directory
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Enter');

  // Wait for the JS file to open in the editor
  const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${componentName}.js"]`);
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
 * Opens a file by name using the Go to File quick open (Ctrl+P).
 * Navigates to the first result that matches the exact filename.
 */
export const openLwcFile = async (page: Page, fileName: string): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Go to File');

  const widget = page.locator(QUICK_INPUT_WIDGET);
  await expect(widget).toBeVisible({ timeout: 10_000 });

  await page.keyboard.type(fileName);
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.press('Enter');

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
