/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import { clickModalDialogButton, NOTIFICATION_LIST_ITEM, saveScreenshot } from '@salesforce/playwright-vscode-ext';

/**
 * Wait for progress notification to appear
 */
const waitForRetrieveProgressNotificationToAppear = async (page: Page, timeout: number): Promise<Locator> => {
  const retrieving = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Retrieving\s+/i })
    .first();
  await expect(retrieving, 'Retrieving progress notification should be visible').toBeVisible({ timeout });
  await saveScreenshot(page, 'waitForRetrieveProgressNotificationToAppear.png', true);
  return retrieving;
};

export const confirmOverwriteAndWaitForProgress = async (
  page: Page,
  overwriteText: RegExp,
  timeout: number
): Promise<void> => {
  const dialog = page.locator('.monaco-dialog-box');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(overwriteText);
  const progress = waitForRetrieveProgressNotificationToAppear(page, timeout);
  await clickModalDialogButton(page, 'Yes');
  const retrieving = await progress;
  await expect(retrieving, 'Retrieve operation should finish').toBeHidden({ timeout });
};

/**
 * Trigger a retrieve and wait for progress, confirming an overwrite prompt when
 * the catalog reports that the component is already present in the workspace.
 */
export const retrieveAndWaitForProgress = async (
  page: Page,
  trigger: () => Promise<boolean>,
  overwriteText: RegExp,
  timeout: number
): Promise<boolean> => {
  const progress = waitForRetrieveProgressNotificationToAppear(page, timeout);
  const dialog = page.locator('.monaco-dialog-box');
  const firstSignal = Promise.race([
    progress.then(() => 'progress' as const),
    dialog.waitFor({ state: 'visible', timeout }).then(() => 'overwrite' as const)
  ]);

  const clicked = await trigger();
  if ((await firstSignal) === 'overwrite') {
    await expect(dialog).toContainText(overwriteText);
    await clickModalDialogButton(page, 'Yes');
  }
  const retrieving = await progress;
  await expect(retrieving, 'Retrieve operation should finish').toBeHidden({ timeout });
  return clicked;
};
