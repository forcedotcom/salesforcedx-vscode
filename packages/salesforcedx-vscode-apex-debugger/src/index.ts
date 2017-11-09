/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  EXCEPTION_BREAKPOINT_REQUEST,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  GET_WORKSPACE_SETTINGS_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
  SetExceptionBreakpointsArguments,
  SHOW_MESSAGE_EVENT,
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType,
  WORKSPACE_SETTINGS_REQUEST,
  WorkspaceSettings
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

export class ApexDebuggerConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
      {
        name: 'Launch Apex Debugger',
        type: 'apex',
        request: 'launch',
        userIdFilter: [],
        requestTypeFilter: [],
        entryPointFilter: '',
        sfdxProject: folder ? folder.uri.fsPath : '${workspaceRoot}'
      } as vscode.DebugConfiguration
    ];
  }
}

function registerCommands(): vscode.Disposable {
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
        } else if (event.event === GET_WORKSPACE_SETTINGS_EVENT) {
          const config = vscode.workspace.getConfiguration();
          event.session.customRequest(WORKSPACE_SETTINGS_REQUEST, {
            proxyUrl: config.get('http.proxy', '') as string,
            proxyStrictSSL: config.get('http.proxyStrictSSL', false) as boolean,
            proxyAuth: config.get('http.proxyAuthorization', '') as string,
            connectionTimeoutMs: config.get(
              'salesforcedx-vscode-apex-debugger.connectionTimeoutMs'
            )
          } as WorkspaceSettings);
        }
      }
    }
  );
  const exceptionBreakpointCmd = vscode.commands.registerCommand(
    'sfdx.debug.exception.breakpoint',
    configureExceptionBreakpoint
  );
  return vscode.Disposable.from(customEventHandler, exceptionBreakpointCmd);
}

interface ExceptionBreakpointItem extends vscode.QuickPickItem {
  typeref: string;
  breakMode: DebugProtocol.ExceptionBreakMode;
  uri?: string;
}

interface BreakModeItem extends vscode.QuickPickItem {
  breakMode: DebugProtocol.ExceptionBreakMode;
}

const EXCEPTION_BREAK_MODES: BreakModeItem[] = [
  {
    label: 'Always break',
    description: '',
    breakMode: 'always'
  },
  {
    label: 'Never break',
    description: '',
    breakMode: 'never'
  }
];

async function configureExceptionBreakpoint(): Promise<void> {
  const sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );
  if (sfdxApex && sfdxApex.exports) {
    const exceptionBpInfo: ExceptionBreakpointItem[] = await sfdxApex.exports.getExceptionBreakpointInfo();
    console.log('Retrieved exception breakpoint info from language server');
    const selectExceptionOptions: vscode.QuickPickOptions = {
      placeHolder: 'Select an exception',
      matchOnDescription: true,
      matchOnDetail: true
    };
    const selectedException = await vscode.window.showQuickPick(
      exceptionBpInfo,
      selectExceptionOptions
    );
    if (selectedException) {
      const selectBreakModeOptions: vscode.QuickPickOptions = {
        placeHolder: 'Select break option',
        matchOnDescription: true,
        matchOnDetail: true
      };
      const selectedBreakMode = await vscode.window.showQuickPick(
        EXCEPTION_BREAK_MODES,
        selectBreakModeOptions
      );
      if (selectedBreakMode) {
        selectedException.breakMode = selectedBreakMode.breakMode;
        const args: SetExceptionBreakpointsArguments = {
          exceptionInfo: selectedException
        };
        // TODO: What if there's no active session?
        if (vscode.debug.activeDebugSession) {
          vscode.debug.activeDebugSession.customRequest(
            EXCEPTION_BREAKPOINT_REQUEST,
            args
          );
        }
      }
    }
  }
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
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      'apex',
      new ApexDebuggerConfigurationProvider()
    )
  );
}

export function deactivate() {
  console.log('Apex Debugger Extension Deactivated');
}
