/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { APEX_TRACE_FLAG_STATUS_BAR, executeCommandWithCommandPalette } from '@salesforce/playwright-vscode-ext';

/**
 * Wait for trace flag status bar to show expected text.
 * Uses polling with extended timeout to handle slow Salesforce org API operations.
 *
 * @param page - Playwright page
 * @param expectedTextPattern - Regex pattern to match in status bar (e.g., /Tracing until/, /No Tracing/)
 * @param timeout - Total timeout in ms (default: 90000)
 * @param pollInterval - Check interval in ms (default: 2000)
 */
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

export const deleteActiveTraceFlag = async (
  page: Page,
  deleteCommandTitle: string,
  inactiveTimeout = 60_000
): Promise<void> => {
  const activeTraceFlag = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
  if (await activeTraceFlag.isVisible({ timeout: 1000 }).catch(() => false)) {
    await executeCommandWithCommandPalette(page, deleteCommandTitle);
    await waitForTraceFlagStatusBar(page, /No Tracing/, inactiveTimeout);
  }
};
