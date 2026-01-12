/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../pages/commands';
import { closeSettingsTab, closeWelcomeTabs } from './helpers';
import { WORKBENCH, QUICK_INPUT_WIDGET, EDITOR_WITH_URI, DIRTY_EDITOR, QUICK_INPUT_LIST_ROW } from './locators';

/** Creates a new file with contents using the "File: New Untitled Text File" command and Ctrl+S to save */
export const createFileWithContents = async (page: Page, filePath: string, contents: string): Promise<void> => {
  await page.locator(WORKBENCH).click();

  // Create a new untitled file
  await executeCommandWithCommandPalette(page, 'File: New Untitled Text File');

  // Wait for the editor to open
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
  await editor.click();

  // Type the file contents
  await page.keyboard.type(contents);

  // Use "File: Save As..." command which works in both web and desktop
  await executeCommandWithCommandPalette(page, 'File: Save As...');

  // Wait for the save dialog
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // The save dialog should show an input for the filename
  const input = quickInput.getByRole('textbox').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });

  // Clear any default value and type the full file path
  await page.keyboard.press('Control+a');
  // Build full path: if filePath doesn't start with /, prepend /MyProject/
  const fullPath = filePath.startsWith('/') ? filePath : `/MyProject/${filePath}`;
  await page.keyboard.type(fullPath);
  await page.keyboard.press('Enter');

  // Wait for the dialog to close
  await quickInput.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
    // Dialog might already be hidden
  });

  // Wait for file to be saved (dirty indicator should disappear)
  const dirtyEditor = page.locator(DIRTY_EDITOR);
  const dirtyCount = await dirtyEditor.count();
  if (dirtyCount > 0) {
    await dirtyEditor.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
      // File saved instantly without showing dirty state
    });
  }
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

/** Open a file using Quick Open (Ctrl+P) */
export const openFileByName = async (page: Page, fileName: string): Promise<void> => {
  // Ensure workbench is focused first
  await page.locator(WORKBENCH).click();

  // Open Quick Open with Ctrl+P
  await page.keyboard.press('Control+p');

  // Wait for Quick Open to appear
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 10_000 });

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
export const editOpenFile = async (page: Page, comment: string): Promise<void> => {
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
