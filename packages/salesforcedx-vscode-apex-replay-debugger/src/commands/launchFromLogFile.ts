/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../adapter/debugConfigurationProvider';

/** Start a replay session for `logFile`. Resolves false without launching when a debug session is already
 * open or no workspace folder is open. */
export const launchFromLogFile = async (
  logFile?: string,
  stopOnEntry: boolean = true,
  anonApexFilePath?: string,
  anonApexLineOffset?: number
): Promise<boolean> => {
  if (!vscode.debug.activeDebugSession && vscode.workspace.workspaceFolders?.[0]) {
    const config = DebugConfigurationProvider.getConfig(logFile, stopOnEntry, anonApexFilePath, anonApexLineOffset);
    return vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], config);
  }
  return false;
};
