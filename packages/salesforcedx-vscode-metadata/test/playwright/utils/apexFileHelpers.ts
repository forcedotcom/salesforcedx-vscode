/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';

/** Open a file using Quick Open (Ctrl+P) */
export const openFileByName = async (page: Page, fileName: string): Promise<void> => {
  // Open Quick Open with Ctrl+P
  await page.keyboard.press('Control+p');

  // Wait for Quick Open to appear
  await page.locator('.quick-input-widget').waitFor({ state: 'visible', timeout: 10_000 });

  // Type the filename
  await page.keyboard.type(fileName);

  // Wait a bit for search results
  await page.waitForTimeout(500);

  // Press Enter to open the first result
  await page.keyboard.press('Enter');

  // Wait for editor to open
  await page.locator('.monaco-editor').waitFor({ state: 'visible', timeout: 10_000 });
};

/** Edit the currently open file by adding a comment at the top */
export const editOpenFile = async (page: Page, comment: string): Promise<void> => {
  // Wait for editor to be ready
  const editor = page.locator('.monaco-editor[data-uri]').first();
  await editor.waitFor({ state: 'visible' });

  // Click into the editor to focus it
  await editor.click();

  // Move cursor to start of file
  await page.keyboard.press('Control+Home');

  // Find the first non-comment, non-blank line by reading visible text
  // Move down past header comments
  for (let i = 0; i < 50; i++) {
    // Get current line via Monaco API
    const lineText = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const monacoEditor = (window as any).monaco?.editor?.getEditors?.()?.[0];
      if (!monacoEditor) return '';
      const position = monacoEditor.getPosition();
      const model = monacoEditor.getModel();
      return model?.getLineContent(position.lineNumber) ?? '';
    });

    const trimmed = lineText.trim();
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      await page.keyboard.press('ArrowDown');
    } else {
      break;
    }
  }

  // Add the comment line
  await page.keyboard.press('Home');
  await page.keyboard.type(`// ${comment}`);
  await page.keyboard.press('Enter');

  // Save file
  await page.keyboard.press('Control+s');

  // Wait for save indicator to disappear (file tab loses "dirty" state)
  await page.waitForSelector('.monaco-editor.dirty', { state: 'detached', timeout: 5000 }).catch(() => {
    // Ignore timeout - file might save instantly
  });
};

/** Find and open an Apex class by name, then edit it */
export const findAndEditApexClass = async (page: Page, className: string, comment: string): Promise<void> => {
  await openFileByName(page, `${className}.cls`);
  await editOpenFile(page, comment);
};
