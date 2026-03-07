/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from './commands';

/** Problems view container (panel or sidebar). VS Code uses workbench.panel.markers for the Problems panel. */
const PROBLEMS_VIEW = '[id="workbench.panel.markers"]';
const PROBLEMS_LIST = `${PROBLEMS_VIEW} .monaco-list`;
const PROBLEMS_ROW = `${PROBLEMS_LIST} .monaco-list-row`;

/** Opens the Problems view (idempotent). Uses command palette to focus Problems. */
export const ensureProblemsViewOpen = async (page: Page): Promise<void> => {
  const view = page.locator(PROBLEMS_VIEW);
  if (await view.isVisible().catch(() => false)) {
    return;
  }
  await executeCommandWithCommandPalette(page, 'Problems: Focus on Problems');
  await expect(view).toBeVisible({ timeout: 10_000 });
};

/** Returns the number of problem/diagnostic rows in the Problems view. Call ensureProblemsViewOpen first. */
export const getProblemsCount = async (page: Page): Promise<number> => {
  const view = page.locator(PROBLEMS_VIEW);
  await expect(view).toBeVisible({ timeout: 5000 });
  const rows = page.locator(PROBLEMS_ROW);
  return rows.count();
};

const assertProblemsCount = async (
  page: Page,
  check: (count: number) => void,
  opts?: { timeout?: number }
): Promise<void> => {
  const { timeout = 10_000 } = opts ?? {};
  await ensureProblemsViewOpen(page);
  await expect(async () => {
    const count = await getProblemsCount(page);
    check(count);
  }).toPass({ timeout });
};

/** Asserts the Problems view has exactly `expectedCount` diagnostics. Opens the view if needed. */
export const expectProblemsCount = (page: Page, expectedCount: number, opts?: { timeout?: number }) =>
  assertProblemsCount(
    page,
    count => expect(count, `Expected ${expectedCount} problem(s), got ${count}`).toBe(expectedCount),
    opts
  );

/** Asserts the Problems view has at least `minCount` diagnostics. Opens the view if needed. */
export const expectProblemsCountAtLeast = (page: Page, minCount: number, opts?: { timeout?: number }) =>
  assertProblemsCount(
    page,
    count =>
      expect(count, `Expected at least ${minCount} problem(s), got ${count}`).toBeGreaterThanOrEqual(minCount),
    opts
  );
