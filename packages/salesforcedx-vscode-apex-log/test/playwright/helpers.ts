/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { APEX_TRACE_FLAG_STATUS_BAR, executeCommandWithCommandPalette } from '@salesforce/playwright-vscode-ext';

import packageNls from '../../package.nls.json';

/**
 * Opens traceFlags.json and removes all debug levels via their Remove code lenses.
 * With no debug levels present, createTraceFlagForCurrentUser will auto-create
 * ReplayDebuggerLevels instead of showing the debug level picker.
 * Safe to call when no debug levels exist — the step is a no-op in that case.
 */
export const removeAllDebugLevels = async (page: Page): Promise<void> => {
  const removeLinks = page.locator('.codelens-decoration a').filter({ hasText: /^Remove$/ });

  // Re-open on each iteration so the content provider re-fetches fresh data.
  // toPass retries if the extension isn't ready yet or data loads asynchronously
  // after the initial render. Throwing after a successful click triggers another
  // iteration to check for remaining entries.
  await expect(async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsOpen']);
    await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.codelens-decoration a').filter({ hasText: /Create Debug level/ })).toBeVisible({
      timeout: 10_000
    });

    const debugLevelsLine = page
      .locator('.view-line')
      .filter({ hasText: /"debugLevels"/ })
      .first();
    await expect(debugLevelsLine).toBeVisible({ timeout: 5000 });
    const debugLevelsBounds = await debugLevelsLine.boundingBox();
    if (!debugLevelsBounds) return;

    const links = await removeLinks.all();
    for (const link of links) {
      const bounds = await link.boundingBox();
      if (bounds && bounds.y > debugLevelsBounds.y) {
        await link.click();
        await expect(removeLinks).not.toHaveCount(links.length, { timeout: 10_000 });
        throw new Error('removed one debug level, checking for more');
      }
    }
  }).toPass({ timeout: 60_000 });
};

export const waitForTraceFlagStatusBar = async (
  page: Page,
  expectedTextPattern: RegExp,
  timeout = 90_000,
  pollInterval = 2000
): Promise<void> => {
  // Status bar update can be slow - use polling with longer timeout
  await expect(async () => {
    const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: expectedTextPattern });
    await expect(statusBar).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout, intervals: [pollInterval] });
};
