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
/** Rows that represent actual diagnostics (have severity icon). Tree parent rows (file groups) do not. */
const PROBLEMS_ERROR_ROW = `${PROBLEMS_VIEW} .monaco-list-row .codicon-error`;
const PROBLEMS_FILTER_INPUT = 'input[aria-label="Filter Problems"]';

/** Opens the Problems view (idempotent). Uses command palette to focus Problems. */
export const ensureProblemsViewOpen = async (page: Page): Promise<void> => {
  const view = page.locator(PROBLEMS_VIEW);
  if (await view.isVisible().catch(() => false)) {
    return;
  }
  await executeCommandWithCommandPalette(page, 'Problems: Focus on Problems View');
  await expect(view).toBeVisible({ timeout: 10_000 });
};

/** Returns the number of problem diagnostics (counts rows with error icon, not tree parent rows). Call ensureProblemsViewOpen first. */
export const getProblemsCount = async (page: Page): Promise<number> => {
  const view = page.locator(PROBLEMS_VIEW);
  await expect(view).toBeVisible({ timeout: 5000 });
  const rows = page.locator(PROBLEMS_ERROR_ROW);
  return rows.count();
};

/** Clears Problems view filter so diagnostics count is not masked by stale text. */
const clearProblemsFilter = async (page: Page): Promise<void> => {
  await ensureProblemsViewOpen(page);
  const input = page.locator(PROBLEMS_FILTER_INPUT).first();
  if (!(await input.isVisible().catch(() => false))) {
    return;
  }
  await input.focus();
  await input.fill('');
};

const assertProblemsCount = async (
  page: Page,
  check: (count: number) => void,
  opts?: { timeout?: number }
): Promise<void> => {
  const { timeout = 10_000 } = opts ?? {};
  await ensureProblemsViewOpen(page);
  await clearProblemsFilter(page);
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
    count => expect(count, `Expected at least ${minCount} problem(s), got ${count}`).toBeGreaterThanOrEqual(minCount),
    opts
  );
