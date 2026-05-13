/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { APEX_TRACE_FLAG_STATUS_BAR } from '@salesforce/playwright-vscode-ext';

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
