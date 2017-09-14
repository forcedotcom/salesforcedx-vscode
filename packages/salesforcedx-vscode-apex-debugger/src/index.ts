/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  GET_LINE_BREAKPOINT_INFO_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
  SHOW_MESSAGE_EVENT,
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import * as vscode from 'vscode';

const initialDebugConfigurations = {
  version: '0.2.0',
  configurations: [
    {
      name: 'Launch Apex Debugger',
      type: 'apex',
      request: 'launch',
      userIdFilter: '',
      requestTypeFilter: '',
      entryPointFilter: '',
      sfdxProject: '${workspaceRoot}'
    }
  ]
};

function registerCommands(): vscode.Disposable {
  const initialDebugConfig = vscode.commands.registerCommand(
    'sfdx.debug.provideInitialConfigurations',
    () => {
      return [JSON.stringify(initialDebugConfigurations, null, '\t')].join(
        '\n'
      );
    }
  );
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(
    async event => {
      if (event && event.session) {
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
        } else if (event.event === SHOW_MESSAGE_EVENT) {
          const eventBody = event.body as VscodeDebuggerMessage;
          if (eventBody && eventBody.type && eventBody.message) {
            switch (eventBody.type as VscodeDebuggerMessageType) {
              case VscodeDebuggerMessageType.Info: {
                vscode.window.showInformationMessage(eventBody.message);
                break;
              }
              case VscodeDebuggerMessageType.Warning: {
                vscode.window.showWarningMessage(eventBody.message);
                break;
              }
              case VscodeDebuggerMessageType.Error: {
                vscode.window.showErrorMessage(eventBody.message);
                break;
              }
            }
          }
        }
      }
    }
  );
  return vscode.Disposable.from(initialDebugConfig, customEventHandler);
}

function registerFileWatchers(): vscode.Disposable {
  const clsWatcher = vscode.workspace.createFileSystemWatcher('**/*.cls');
  clsWatcher.onDidChange(uri => notifyDebuggerSessionFileChanged());
  clsWatcher.onDidCreate(uri => notifyDebuggerSessionFileChanged());
  clsWatcher.onDidDelete(uri => notifyDebuggerSessionFileChanged());
  const trgWatcher = vscode.workspace.createFileSystemWatcher('**/*.trigger');
  trgWatcher.onDidChange(uri => notifyDebuggerSessionFileChanged());
  trgWatcher.onDidCreate(uri => notifyDebuggerSessionFileChanged());
  trgWatcher.onDidDelete(uri => notifyDebuggerSessionFileChanged());
  return vscode.Disposable.from(clsWatcher, trgWatcher);
}

function notifyDebuggerSessionFileChanged(): void {
  if (vscode.debug.activeDebugSession) {
    vscode.debug.activeDebugSession.customRequest(HOTSWAP_REQUEST);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Apex Debugger Extension Activated');
  const commands = registerCommands();
  const fileWatchers = registerFileWatchers();
  context.subscriptions.push(commands, fileWatchers);
}

export function deactivate() {
  console.log('Apex Debugger Extension Deactivated');
}
