/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Apex Replay Debugger Extension Activated');
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.replay-debugger.getLogFileName',
      config => {
        return vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false
        });
      }
    )
  );
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      'apex-replay',
      new DebugConfigurationProvider()
    )
  );
}
export function deactivate() {
  console.log('Apex Replay Debugger Extension Deactivated');
}
