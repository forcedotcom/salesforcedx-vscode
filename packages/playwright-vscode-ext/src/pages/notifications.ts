/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page, type Locator } from '@playwright/test';
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

/**
 * Wait for a notification matching `pattern` (regex against the notification text) to appear.
 * Returns the notification locator so callers can act on it (e.g. click an action button).
 */
export const waitForNotification = async (
  page: Page,
  pattern: RegExp,
  opts?: { timeout?: number }
): Promise<Locator> => {
  const { timeout = 60_000 } = opts ?? {};
  const notification = page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: pattern }).first();
  await expect(notification, `Notification matching ${pattern} should appear`).toBeVisible({ timeout });
  return notification;
};

/**
 * Wait for a notification matching `pattern` and click the named action button on it (e.g. `Open Report`).
 */
export const acceptNotification = async (
  page: Page,
  pattern: RegExp,
  buttonName: string,
  opts?: { timeout?: number }
): Promise<void> => {
  const notification = await waitForNotification(page, pattern, opts);
  const button = notification.getByRole('button', { name: buttonName });
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click({ timeout: 5000 });
};
