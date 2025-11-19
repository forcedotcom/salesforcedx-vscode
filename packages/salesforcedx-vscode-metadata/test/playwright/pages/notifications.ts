/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page, type Locator } from '@playwright/test';
import { saveScreenshot } from 'salesforcedx-vscode-playwright';

/** Wait for deploy progress notification to appear */
export const waitForDeployProgressNotificationToAppear = async (page: Page, timeout = 30_000): Promise<Locator> => {
  const deploying = page
    .locator('.monaco-workbench .notification-list-item')
    .filter({ hasText: /Deploying/i })
    .first();

  await expect(deploying, 'Deploying progress notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForDeployProgressNotificationToAppear.png', true);
  return deploying;
};

/** Wait for deploy error notification */
export const waitForDeployErrorNotification = async (page: Page, timeout = 30_000): Promise<Locator> => {
  const error = page
    .locator('.monaco-workbench .notification-list-item')
    .filter({ hasText: /deploy.*failed|deploy.*error/i })
    .first();

  await expect(error, 'Deploy error notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForDeployErrorNotification.png', true);
  return error;
};

/** Wait for deploy success notification */
export const waitForDeploySuccessNotification = async (page: Page, timeout = 60_000): Promise<Locator> => {
  const success = page
    .locator('.monaco-workbench .notification-list-item')
    .filter({ hasText: /deploy.*succeeded|deploy.*success/i })
    .first();

  await expect(success, 'Deploy success notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForDeploySuccessNotification.png', true);
  return success;
};
