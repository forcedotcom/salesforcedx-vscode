/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../adapter/debugConfigurationProvider';

export function launchFromLogFile(logFile?: string) {
  if (
    !vscode.debug.activeDebugSession &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    vscode.debug.startDebugging(
      vscode.workspace.workspaceFolders[0],
      DebugConfigurationProvider.getConfig(logFile)
    );
  }
}
