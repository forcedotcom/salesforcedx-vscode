/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, expect } from '@playwright/test';
import {
  clearOutputChannel,
  clickModalDialogButton,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

/** Trigger a retrieve and confirm an overwrite prompt if the component already exists. */
export const retrieveAndHandleOverwrite = async (
  page: Page,
  trigger: () => Promise<boolean>,
  overwriteText: RegExp,
  timeout: number
): Promise<boolean> => {
  const dialog = page.locator('.monaco-dialog-box');
  const clicked = await trigger();
  const overwriteVisible = await dialog
    // Computing the project ComponentSet can take noticeably longer on CI and in
    // web. Do not open the Output panel while that prompt is still pending: the
    // command used to focus Output would dismiss the late modal.
    .waitFor({ state: 'visible', timeout: Math.min(timeout, 30_000) })
    .then(() => true)
    .catch(() => false);
  if (overwriteVisible) {
    await expect(dialog).toContainText(overwriteText);
    await clickModalDialogButton(page, 'Yes');
  }
  return clicked;
};

/** Confirm a known overwrite and wait for the retrieve's durable completion output. */
export const overwriteAndWaitForCompletion = async (
  page: Page,
  trigger: () => Promise<boolean>,
  overwriteText: RegExp,
  timeout: number
): Promise<boolean> => {
  // The first retrieve has activated the Org Browser channel. Clear it before
  // starting the next operation so an older completion cannot satisfy this wait.
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Salesforce Org Browser', timeout);
  await clearOutputChannel(page);

  const clicked = await trigger();
  const dialog = page.locator('.monaco-dialog-box');
  await expect(dialog).toBeVisible({ timeout });
  await expect(dialog).toContainText(overwriteText);
  await clickModalDialogButton(page, 'Yes');
  await waitForOutputChannelText(page, { expectedText: 'Retrieve completed.', timeout });
  return clicked;
};
