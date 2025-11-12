/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

/** Prompts user for input and returns trimmed value */
export const getFormattedString = async (prompt: string, value?: string) => {
  const input = await vscode.window.showInputBox({
    prompt,
    value
  });
  return input ? input.trim() : input;
};
