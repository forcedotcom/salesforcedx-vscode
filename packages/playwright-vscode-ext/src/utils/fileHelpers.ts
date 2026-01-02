/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../pages/commands';
import { closeSettingsTab, closeWelcomeTabs, isWindowsDesktop } from './helpers';
import { WORKBENCH, QUICK_INPUT_WIDGET, EDITOR_WITH_URI, DIRTY_EDITOR, QUICK_INPUT_LIST_ROW } from './locators';

/** Creates a new file with contents using the "Create: New File..." command */
export const createFileWithContents = async (page: Page, filePath: string, contents: string): Promise<void> => {
  await page.locator(WORKBENCH).click();

  // Close all open editors so the "Create: New File..." command defaults to project root
  await executeCommandWithCommandPalette(page, 'View: Close All Editors');

  // Focus the explorer and click on workspace root
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  const workspaceRoot = page.locator('.monaco-list-row[aria-level="1"]').first();
  await workspaceRoot.click();

  // Parse the file path to get the filename for the first dialog
  const lastSlash = filePath.lastIndexOf('/');
  const fileName = lastSlash > 0 ? filePath.substring(lastSlash + 1) : filePath;

  // Now create the new file
  await executeCommandWithCommandPalette(page, 'Create: New File...');
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // First dialog: "Select File Type or Enter File Name..."
  // Type just the filename (e.g., "package.xml")
  await page.keyboard.type(fileName);
  await page.keyboard.press('Enter');

  // Second dialog: "Create File" asks for folder path
  // Wait for the folder path textbox to appear, then find the OK button
  const folderPathInput = page.getByRole('textbox', { name: /Folder path/i });
  await folderPathInput.waitFor({ state: 'visible', timeout: 5000 });

  // The OK button should be next to the input - use exact match to avoid status bar conflicts
  const okButton = page.getByRole('button', { name: 'OK', exact: true });

  // Clear the path and type the full file path
  // Use absolute path from workspace root (workspace name is typically "MyProject" in test environments)
  await page.keyboard.press('Control+a');
  // Build full path: if filePath doesn't start with /, prepend /MyProject/
  const fullPath = filePath.startsWith('/') ? filePath : `/MyProject/${filePath}`;
  await page.keyboard.type(fullPath);

  await okButton.click();

  // Handle any additional OK confirmations (folder creation, file exists, etc.)
  // Wait for the dialog to potentially change, then check for another OK button
  for (let i = 0; i < 3; i++) {
    // Wait a moment for the dialog to update
    await quickInput.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});

    const confirmOk = page.getByRole('button', { name: 'OK', exact: true });
    // Use a short timeout to check if button is clickable
    const clicked = await confirmOk
      .click({ timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) {
      break;
    }
  }

  // Wait for the dialog to close
  await quickInput.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
    // Dialog might already be hidden
  });

  // Wait for an editor to be visible and click into it to focus
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
  await editor.click();

  // Type the file contents
  await page.keyboard.type(contents);

  // Save the file
  await page.keyboard.press('Control+s');

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

  // On Windows desktop, target the Monaco editor's textarea directly for more reliable keyboard input
  // On web and macOS desktop, clicking the editor container works fine
  if (isWindowsDesktop()) {
    const inputArea = editor.locator('textarea.inputarea').first();
    await inputArea.waitFor({ state: 'attached', timeout: 5000 });
    await inputArea.click();
  } else {
    await editor.click();
  }

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
