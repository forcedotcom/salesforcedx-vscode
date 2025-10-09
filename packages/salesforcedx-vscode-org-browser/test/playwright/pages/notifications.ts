/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';

/**
 * Wait for progress notification to appear
 */
export const waitForRetrieveProgressNotificationToAppear = async (page: Page, timeout: number): Promise<Locator> => {
  const retrieving = page
    .locator('.monaco-workbench .notification-list-item')
    .filter({ hasText: /Retrieving\s+/i })
    .first();
  await expect(retrieving, 'Retrieving progress notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForRetrieveProgressNotificationToAppear.png', true);
  return retrieving;
};
