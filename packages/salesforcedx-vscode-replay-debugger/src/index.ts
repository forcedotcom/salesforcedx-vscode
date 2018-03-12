/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import {
  CheckpointMessage,
  checkpointService
} from './breakpoints/checkpointService';
import {
  CHECKPOINT_INFO_EVENT,
  DEBUGGER_TYPE,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  LINE_BREAKPOINT_INFO_REQUEST
} from './constants';

function registerCommands(): vscode.Disposable {
  const promptForLogCmd = vscode.commands.registerCommand(
    'extension.replay-debugger.getLogFileName',
    async config => {
      const fileUris:
        | vscode.Uri[]
        | undefined = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        defaultUri: getDialogStartingPath()
      });
      if (fileUris && fileUris.length === 1) {
        return fileUris[0].fsPath;
      }
    }
  );
  return vscode.Disposable.from(promptForLogCmd);
}

function registerDebugHandlers(): vscode.Disposable {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(
    async event => {
      if (event && event.session && event.session.type === DEBUGGER_TYPE) {
        if (event.event === GET_LINE_BREAKPOINT_INFO_EVENT) {
          const sfdxApex = vscode.extensions.getExtension(
            'salesforce.salesforcedx-vscode-apex'
          );
          if (sfdxApex && sfdxApex.exports) {
            const lineBpInfo = await sfdxApex.exports.getLineBreakpointInfo();
            event.session.customRequest(
              LINE_BREAKPOINT_INFO_REQUEST,
              lineBpInfo
            );
            console.log('Retrieved line breakpoint info from language server');
          }
        } else if (event.event === CHECKPOINT_INFO_EVENT) {
          const eventBody = event.body as CheckpointMessage;
          if (
            eventBody &&
            eventBody.sourceFile &&
            eventBody.typeRef &&
            eventBody.line
          ) {
            checkpointService.addCheckpointNode(
              eventBody.sourceFile,
              eventBody.typeRef,
              eventBody.line
            );
          }
        }
      }
    }
  );
  return vscode.Disposable.from(customEventHandler);
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Apex Replay Debugger Extension Activated');
  const commands = registerCommands();
  const debugHandlers = registerDebugHandlers();
  const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
    'apex-replay',
    new DebugConfigurationProvider()
  );
  const checkpointsView = vscode.window.registerTreeDataProvider(
    'sfdx.force.view.checkpoint',
    checkpointService
  );
  context.subscriptions.push(
    commands,
    debugHandlers,
    debugConfigProvider,
    checkpointsView
  );
}

function getDialogStartingPath(): vscode.Uri | undefined {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    return vscode.Uri.file(
      path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.sfdx')
    );
  }
}

export function deactivate() {
  console.log('Apex Replay Debugger Extension Deactivated');
}
