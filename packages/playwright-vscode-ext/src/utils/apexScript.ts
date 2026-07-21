/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../pages/commands';
import { openFileByName } from './fileHelpers';
import { waitForQuickInputFirstOption } from './helpers';
import { QUICK_INPUT_WIDGET } from './locators';

/**
 * Creates a named .apex script file via the command palette and returns with the file open.
 *
 * Targets the **desktop** locator pattern (`keyboard.type` + `openFileByName`).
 * Headless specs that use `fill()` / `EDITOR_WITH_URI` should retain their inline implementation.
 */
export const createAndOpenApexScript = async (
  page: Page,
  opts: {
    commandLabel: string;
    name: string;
    content?: string;
  }
): Promise<void> => {
  await executeCommandWithCommandPalette(page, opts.commandLabel);
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type(opts.name);
  await page.keyboard.press('Enter');
  await waitForQuickInputFirstOption(page);
  await page.keyboard.press('Enter');

  const escapedName = opts.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .locator('.tab')
    .filter({ hasText: new RegExp(`${escapedName}\\.apex`) })
    .waitFor({ state: 'visible', timeout: 15_000 });
  await openFileByName(page, `${opts.name}.apex`);

  if (opts.content) {
    // Populate the .apex file with content
    const editorArea = page.locator('.editor-instance .view-lines').first();
    await editorArea.click({ force: true });
    await page.keyboard.press('Control+a');
    await page.keyboard.type(opts.content);
    await page.keyboard.press('Control+s');
  }
};
