/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page, type Locator } from '@playwright/test';
import { saveScreenshot, NOTIFICATION_LIST_ITEM } from '@salesforce/playwright-vscode-ext';

/** Wait for deploy progress notification to appear */
export const waitForDeployProgressNotificationToAppear = async (page: Page, timeout = 30_000): Promise<Locator> => {
  const deploying = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Deploying/i })
    .first();

  await expect(deploying, 'Deploying progress notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForDeployProgressNotificationToAppear.png', true);
  return deploying;
};

/** Wait for retrieve progress notification to appear */
export const waitForRetrieveProgressNotificationToAppear = async (page: Page, timeout = 30_000): Promise<Locator> => {
  const retrieving = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Retrieving/i })
    .first();

  await expect(retrieving, 'Retrieving progress notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForRetrieveProgressNotificationToAppear.png', true);
  return retrieving;
};
