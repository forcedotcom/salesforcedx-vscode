/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page } from '@playwright/test';
import { escapeRegExp } from '../utils/helpers';
import { CODELENS_ITEM, EDITOR_WITH_URI } from '../utils/locators';
import { focusActiveEditorGroup } from './nativeCommands';

/**
 * Click the first code lens whose visible text matches `text` (whitespace-tolerant exact match).
 * Waits for the lens to be visible before clicking. Use this for Apex code-lens actions like
 * "Run All Tests", "Run Test", "Debug All Tests", "Debug Test".
 *
 * Limitation: returns the *first* matching lens in DOM order. For files with multiple test
 * methods sharing the same lens label (e.g. several `Run Test` lenses), the caller must scope
 * the search themselves — this helper does not disambiguate by line/method.
 *
 * Apex callers should pass a longer `timeout` (e.g. 180_000) — Apex LSP indexing on cold CI
 * caches can take 60-120s before code lenses resolve.
 */
export const clickCodeLens = async (page: Page, text: string, opts?: { timeout?: number }): Promise<void> => {
  const { timeout = 60_000 } = opts ?? {};

  // Ensure an editor is the active part of the workbench (output/terminal panels can steal focus).
  // No-op if already focused; "View: Focus Active Editor Group" exists in all VS Code versions.
  await focusActiveEditorGroup(page).catch(() => {});
  await page
    .locator(EDITOR_WITH_URI)
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .catch(() => {});

  // Allow leading/trailing whitespace inside the codelens decoration (Monaco occasionally
  // wraps the link text with separator spans), so anchored `^...$` doesn't fail spuriously.
  const lens = page
    .locator(CODELENS_ITEM)
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`) })
    .first();
  await lens.waitFor({ state: 'visible', timeout });
  await lens.click({ timeout });
};
