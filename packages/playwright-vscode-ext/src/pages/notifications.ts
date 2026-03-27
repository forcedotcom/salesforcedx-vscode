/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { NOTIFICATION_LIST_ITEM } from '../utils/locators';

/**
 * Resolves when no `withProgress` toast for Run Apex Tests remains (no Cancel — run finished or toast dismissed).
 * Ignores the separate "successfully ran" toast (no Cancel). Safe if progress never appeared.
 */
export const waitForRunApexTestsProgressNotificationGone = async (
  page: Page,
  opts?: { timeout?: number }
): Promise<void> => {
  const { timeout = 600_000 } = opts ?? {};
  const progressWithCancel = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /SFDX: Run Apex Tests/ })
    .filter({ has: page.getByRole('button', { name: 'Cancel' }) });
  await expect(async () => {
    expect(await progressWithCancel.count()).toBe(0);
  }).toPass({ timeout });
};
