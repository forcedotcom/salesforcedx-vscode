/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ModalDialog } from 'vscode-extension-tester';

/**
 * Clicks a button on a modal dialog with the specified button text.
 *
 * @param buttonText - The text of the button to be clicked on the modal dialog.
 * @returns A promise that resolves when the button click action is completed.
 * @throws Will throw an error if the modal dialog is undefined.
 */
export const clickButtonOnModalDialog = async (buttonText: string): Promise<void> => {
  const modalDialog = new ModalDialog();
  expect(modalDialog).to.not.be.undefined;
  await modalDialog.pushButton(buttonText);
}
