/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../adapter/debugConfigurationProvider';

/** Start a replay session for `logFile`. Returns false without launching when a debug session is already open
 * or no workspace folder is open. */
export const launchFromLogFile = Effect.fn('ApexReplayDebugger.launchFromLogFile')(function* (
  logFile?: string,
  stopOnEntry: boolean = true,
  anonApexFilePath?: string,
  anonApexLineOffset?: number
) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (vscode.debug.activeDebugSession || !workspaceFolder) return false;
  const config = DebugConfigurationProvider.getConfig(logFile, stopOnEntry, anonApexFilePath, anonApexLineOffset);
  return yield* Effect.promise(() => vscode.debug.startDebugging(workspaceFolder, config));
});
