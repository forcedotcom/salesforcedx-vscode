/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import { WORKBENCH } from '@salesforce/playwright-vscode-ext';

/** Continue debug session (dismiss hover, Escape, then F5). Repeats until session ends. */
export const continueDebugSession = async (page: Page, maxContinues = 3): Promise<void> => {
  const toolbar = page.locator('.debug-toolbar');
  for (let i = 0; i < maxContinues; i++) {
    await toolbar.waitFor({ state: 'visible', timeout: 15_000 });
    // Click editor area to dismiss search-bar hover that can cover debug toolbar and block F5
    await page.locator(`${WORKBENCH} .editor-instance .view-lines`).first().click({ force: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F5');
    const sessionEnded = await expect(toolbar)
      .not.toBeVisible({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (sessionEnded) break;
  }
  await expect(toolbar).not.toBeVisible({ timeout: 45_000 });
};
