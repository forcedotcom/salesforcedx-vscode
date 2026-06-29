/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';

/**
 * Click a button on a `showWarningMessage/showInformationMessage({ modal: true })` dialog by its label
 * (e.g. 'Overwrite', 'Logout'). Requires `window.dialogStyle: custom`. Callers that expect the dialog
 * to be optional should pass a short timeout and wrap with `.catch`.
 */
export const clickModalDialogButton = async (page: Page, label: string, timeout = 5000): Promise<void> => {
  const dialogButton = page
    .locator('.monaco-dialog-box, .dialog-shadow')
    .getByRole('button', { name: label, exact: true })
    .first();
  await expect(dialogButton).toBeVisible({ timeout });
  await dialogButton.click();
};
