/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page } from '@playwright/test';
import { CODELENS_ITEM } from '../utils/locators';

const escapeRegExp = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Click the first code lens whose visible text exactly matches `text`. Waits for the lens to be
 * visible before clicking. Use this for Apex code-lens actions like "Run All Tests", "Run Test",
 * "Debug All Tests", "Debug Test".
 */
export const clickCodeLens = async (page: Page, text: string, opts?: { timeout?: number }): Promise<void> => {
  const { timeout = 60_000 } = opts ?? {};
  const lens = page
    .locator(CODELENS_ITEM)
    .filter({ hasText: new RegExp(`^${escapeRegExp(text)}$`) })
    .first();
  await lens.waitFor({ state: 'visible', timeout });
  await lens.click({ timeout: 5000 });
};
