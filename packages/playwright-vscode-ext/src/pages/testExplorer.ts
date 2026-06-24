/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page } from '@playwright/test';
import { EDITOR } from '../utils/locators';

/** The Testing view container. */
export const TEST_EXPLORER_PANEL = '[id="workbench.view.extension.test"]';

/** A row in the Test Explorer tree. */
export const TEST_EXPLORER_TREE_ITEM = '[role="treeitem"]';

/**
 * Types `text` into the Test Explorer filter box, replacing whatever is there.
 *
 * Desktop uses a Monaco editor (`data-uri="testing:filter"`) backed by a hidden `<textarea>`;
 * web uses a plain input. The Monaco view-lines layer intercepts pointer events, so click the
 * wrapper (force) and drive keys via `page.keyboard` (focused on the hidden textarea). On macOS
 * Ctrl+A is bound to "cursor home" in Monaco, not select-all, so clear with Home → Shift+End → Delete.
 *
 * Pass an empty string to clear the filter (or use {@link clearFilter}).
 */
export const focusAndTypeInFilter = async (page: Page, text: string): Promise<void> => {
  const monacoFilter = page.locator(`${EDITOR}[data-uri="testing:filter"]`);
  const inputFilter = page.locator('input[placeholder*="Filter"][placeholder*="@tag"]');
  if (await monacoFilter.isVisible().catch(() => false)) {
    await monacoFilter.click({ force: true });
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.keyboard.press('Delete');
    if (text) await page.keyboard.type(text);
  } else {
    await inputFilter.waitFor({ state: 'visible', timeout: 10_000 });
    await inputFilter.fill(text);
  }
};

/** Clears the Test Explorer filter box and dismisses the filter UI. */
export const clearFilter = async (page: Page): Promise<void> => {
  await focusAndTypeInFilter(page, '');
  await page.keyboard.press('Escape');
};
