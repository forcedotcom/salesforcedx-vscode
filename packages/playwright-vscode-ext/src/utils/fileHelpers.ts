/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import { WORKBENCH, QUICK_INPUT_WIDGET, EDITOR_WITH_URI, DIRTY_EDITOR } from './locators';

/** Creates a new file with contents using VS Code Quick Open */
export const createFileWithContents = async (page: Page, filePath: string, contents: string): Promise<void> => {
  // Ensure the workbench is focused first
  await page.locator(WORKBENCH).click();

  // Open Quick Open (Ctrl+P)
  await page.keyboard.press('Control+p');
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // Type the file path directly - VS Code will create it if it doesn't exist
  await page.keyboard.type(filePath);
  await page.keyboard.press('Enter');

  // Wait for Quick Open to disappear
  await quickInput.waitFor({ state: 'hidden', timeout: 10_000 });

  // Wait for editor to open - use a more general selector first
  await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 10_000 });

  // Type the file contents
  await page.keyboard.type(contents);

  // Save file (Ctrl+S)
  await page.keyboard.press('Control+s');

  // Wait for save to complete - file might save instantly so detached state is acceptable
  const dirtyEditor = page.locator(DIRTY_EDITOR);
  const isDirty = await dirtyEditor.count();
  if (isDirty > 0) {
    await dirtyEditor.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
      // File saved instantly without showing dirty state
    });
  }
};
