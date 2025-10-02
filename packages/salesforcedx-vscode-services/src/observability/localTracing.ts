/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { SALESFORCE_DX_SECTION } from '../constants';

/** Get local traces enabled setting */
export const getLocalTracesEnabled = (): boolean => {
  // eslint-disable-next-line functional/no-try-statements
  try {
    const config = vscode.workspace.getConfiguration(SALESFORCE_DX_SECTION);
    return config.get('enableLocalTraces') ?? false;
  } catch {
    // Return false during tests or when VS Code API is not available
    return false;
  }
};
