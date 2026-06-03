/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page } from '@playwright/test';
import { escapeRegExp } from '../utils/helpers';
import { CODELENS_ITEM, EDITOR_WITH_URI } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

/**
 * Click the first code lens whose visible text matches `text` (whitespace-tolerant exact match).
 * Waits for the lens to be visible before clicking. Use this for Apex code-lens actions like
 * "Run All Tests", "Run Test", "Debug All Tests", "Debug Test".
 *
 * Limitation: returns the *first* matching lens in DOM order. For files with multiple test
 * methods sharing the same lens label (e.g. several `Run Test` lenses), the caller must scope
 * the search themselves — this helper does not disambiguate by line/method.
 *
 * Implementation: Code lenses (especially Apex) can take a while to appear after the editor opens
 * or after the active group changes (e.g. when the output panel was just opened). Steps:
 * 1. If the Apex Language Status "Indexing complete" indicator is visible, the LSP is ready and
 * lenses should resolve quickly. Otherwise wait up to 120s for it (CI Apex LSP startup can take
 * 60-120s on a cold cache). Best-effort — non-Apex lenses won't have this status, so a missing
 * button is not an error.
 * 2. Focus the active editor group so lenses render (output/terminal can steal focus).
 * 3. Wait for the lens text and click it.
 */
export const clickCodeLens = async (page: Page, text: string, opts?: { timeout?: number }): Promise<void> => {
  const { timeout = 60_000 } = opts ?? {};

  // Best-effort: wait for Apex LSP "Indexing complete" status bar button if present. This
  // dramatically reduces flake on CI where Apex LSP indexing can outlast a 60s lens wait.
  // Skip silently if the button never appears (non-Apex file, or VS Code version without it).
  const indexingComplete = page.getByRole('button', { name: /Indexing complete/ }).first();
  await indexingComplete.waitFor({ state: 'visible', timeout: 120_000 }).catch(() => {});

  // Ensure an editor is the active part of the workbench (output/terminal panels can steal focus).
  // No-op if already focused; "View: Focus Active Editor Group" exists in all VS Code versions.
  await executeCommandWithCommandPalette(page, 'View: Focus Active Editor Group').catch(() => {});
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
