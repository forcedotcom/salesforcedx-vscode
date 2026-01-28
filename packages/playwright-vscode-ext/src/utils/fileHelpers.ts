/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../pages/commands';
import { closeSettingsTab, closeWelcomeTabs, isMacDesktop } from './helpers';
import { WORKBENCH, QUICK_INPUT_WIDGET, EDITOR_WITH_URI, DIRTY_EDITOR, QUICK_INPUT_LIST_ROW } from './locators';

/**
 * Creates a new untitled file with contents.
 * NOTE: This creates an UNTITLED file that is NOT saved to disk.
 * For tests that need actual files on disk, use createApexClass or similar extension commands.
 * The filePath parameter is currently unused - file remains as Untitled-N.
 */
export const createFileWithContents = async (page: Page, _filePath: string, contents: string): Promise<void> => {
  await page.locator(WORKBENCH).click();

  // Create a new untitled file
  await executeCommandWithCommandPalette(page, 'File: New Untitled Text File');

  // Wait for command palette to close first
  const widget = page.locator(QUICK_INPUT_WIDGET);
  await widget.waitFor({ state: 'hidden', timeout: 5000 });

  // Wait for the editor to open - wait for attachment first, then visibility
  // Use expect().toBeAttached() for better error messages and retry logic
  const editor = page.locator(EDITOR_WITH_URI).first();
  await expect(editor).toBeAttached({ timeout: 15_000 });
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();

  // Type the file contents
  await page.keyboard.type(contents);

  // Note: We don't save the file to avoid filesystem/native dialog issues in web
  // The file remains as an untitled file which works identically in web and desktop
};

/** Creates a new Apex class using the SFDX: Create Apex Class command */
export const createApexClass = async (page: Page, className: string, content?: string): Promise<void> => {
  // Close Settings tab to avoid focus issues
  await closeSettingsTab(page);
  await closeWelcomeTabs(page);

  await executeCommandWithCommandPalette(page, 'SFDX: Create Apex Class');

  // First prompt: "Enter Apex class name"
  // Wait for widget to appear first (command palette closes, new prompt opens)
  // Then wait for text to render (CI can be slower)
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
  await quickInput.getByText(/Enter Apex class name/i).waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type(className);
  await page.keyboard.press('Enter');

  // Second prompt: Quick Pick to select output directory - just press Enter to accept default
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Enter');

  // Wait for the editor to open with the new class
  await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });

  // If content is provided, type it into the editor
  if (content !== undefined) {
    await page.keyboard.type(content);
  }
};

/**
 * Open a file using Quick Open.
 * Big caveat: on the web, this'll only work with files that have already been opened, in the editor (not just call didOpen on it!)
 * that's a limitation of web fs on vscode because search/find files doesn't work yet.
 */
export const openFileByName = async (page: Page, fileName: string): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);

  if (isMacDesktop()) {
    // On macOS desktop, Control+P doesn't work reliably, use command palette instead
    await executeCommandWithCommandPalette(page, 'Go to File');

    // Wait for Quick Open widget to be visible and ready
    await expect(widget).toBeVisible({ timeout: 10_000 });
    const input = widget.locator('input.input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.click({ timeout: 5000 });

    // Clear any existing text and ensure input is focused
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
  } else {
    // On web and Windows desktop, Control+P works reliably (original working approach)
    await page.locator(WORKBENCH).click();
    await page.keyboard.press('Control+p');
    await widget.waitFor({ state: 'visible', timeout: 10_000 });
    // Ensure input is focused and ready (matching original behavior)
    const input = widget.locator('input.input');
    await expect(input).toBeVisible({ timeout: 5000 });
  }

  // Type the filename
  await page.keyboard.type(fileName);

  // Wait for search results to populate and stabilize
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 10_000 });
  // Wait for results to be stable (no new results appearing)
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 1000 });

  // Find the result that matches the filename
  const results = page.locator(QUICK_INPUT_LIST_ROW);
  const resultCount = await results.count();
  let foundMatch = false;
  let matchIndex = 0;
  for (let i = 0; i < resultCount; i++) {
    const resultText = await results.nth(i).textContent();
    // Check if the result contains the filename (Quick Open results include path info)
    // Match if filename appears as a complete word (not part of another filename)
    if (
      resultText &&
      (resultText.includes(`/${fileName}`) || resultText.includes(`\\${fileName}`) || resultText.startsWith(fileName))
    ) {
      matchIndex = i;
      foundMatch = true;
      break;
    }
  }

  if (!foundMatch) {
    // Log all available results for debugging
    const allResults: string[] = [];
    for (let i = 0; i < Math.min(resultCount, 10); i++) {
      const text = await results.nth(i).textContent();
      if (text) allResults.push(text.trim());
    }
    // Check if Quick Open might be showing command palette results instead of files
    const firstResult = allResults[0] || '';
    if (firstResult.toLowerCase().includes('similar commands') || firstResult.toLowerCase().includes('no matching')) {
      throw new Error(
        `Quick Open appears to be showing command palette results instead of files. Found ${resultCount} results. First few: ${allResults.join(' | ')}`
      );
    }
    throw new Error(
      `No exact match found for "${fileName}" in Quick Open. Found ${resultCount} results. First few: ${allResults.join(' | ')}`
    );
  }

  // Navigate to the matching result using arrow keys
  for (let i = 0; i < matchIndex; i++) {
    await page.keyboard.press('ArrowDown');
  }

  // Press Enter to open the selected result
  await page.keyboard.press('Enter');

  // Wait for editor to open with the file
  await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 10_000 });
};

/** Edit the currently open file by adding a comment at the top */
export const editAndSaveOpenFile = async (page: Page, comment: string): Promise<void> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.waitFor({ state: 'visible' });

  // Wait for editor content to render (at least one line visible)
  await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });

  // Click the editor container first to ensure it's focused
  // This is needed on all platforms to activate the editor
  await editor.click();

  // Go to end of first line (class declaration)
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('End');

  // Insert new line below and type comment
  await page.keyboard.press('Enter');
  await page.keyboard.type(`// ${comment}`);

  // Save file
  await executeCommandWithCommandPalette(page, 'File: Save');
  await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });
};
