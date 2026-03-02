/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export const getZeroBasedRange = (line: number, column: number): vscode.Range => {
  const pos = new vscode.Position(line > 0 ? line - 1 : 0, column > 0 ? column - 1 : 0);
  return new vscode.Range(pos, pos);
};
