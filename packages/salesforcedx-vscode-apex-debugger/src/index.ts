/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ENV_SFDX_DEFAULTUSERNAME,
  ENV_SFDX_INSTANCE_URL,
  SFDX_CONFIG_ISV_DEBUGGER_SID,
  SFDX_CONFIG_ISV_DEBUGGER_URL
} from '@salesforce/salesforcedx-apex-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src';
import {
  ForceConfigGet,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-apex-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  DEBUGGER_TYPE,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  EXCEPTION_BREAKPOINT_REQUEST,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  GET_WORKSPACE_SETTINGS_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
  LIST_EXCEPTION_BREAKPOINTS_REQUEST,
  SetExceptionBreakpointsArguments,
  SHOW_MESSAGE_EVENT,
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType,
  WORKSPACE_SETTINGS_REQUEST,
  WorkspaceSettings
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { nls } from './messages';

const cachedExceptionBreakpoints: Map<
  string,
  ExceptionBreakpointItem
> = new Map();

export class ApexDebuggerConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    // note: part of this is duplicated in bootstrapCmd.ts but not linked to avoid hard dependency from core to debugger
    return [
      {
        name: 'Launch Apex Debugger',
        type: DEBUGGER_TYPE,
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
  const startSessionHandler = vscode.debug.onDidStartDebugSession(session => {
    cachedExceptionBreakpoints.forEach(breakpoint => {
      const args: SetExceptionBreakpointsArguments = {
        exceptionInfo: breakpoint
      };
      session.customRequest(EXCEPTION_BREAKPOINT_REQUEST, args);
    });
  });

  return vscode.Disposable.from(
    customEventHandler,
    exceptionBreakpointCmd,
    startSessionHandler
  );
}

export interface ExceptionBreakpointItem extends vscode.QuickPickItem {
  typeref: string;
  breakMode: DebugProtocol.ExceptionBreakMode;
  uri?: string;
}

interface BreakModeItem extends vscode.QuickPickItem {
  breakMode: DebugProtocol.ExceptionBreakMode;
}

const EXCEPTION_BREAK_MODES: BreakModeItem[] = [
  {
    label: nls.localize('always_break_text'),
    description: '',
    breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS
  },
  {
    label: nls.localize('never_break_text'),
    description: '',
    breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER
  }
];

async function configureExceptionBreakpoint(): Promise<void> {
  const sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );
  if (sfdxApex && sfdxApex.exports) {
    const exceptionBreakpointInfos: ExceptionBreakpointItem[] = await sfdxApex.exports.getExceptionBreakpointInfo();
    console.log('Retrieved exception breakpoint info from language server');
    let enabledExceptionBreakpointTyperefs: string[] = [];
    if (vscode.debug.activeDebugSession) {
      const responseBody = await vscode.debug.activeDebugSession.customRequest(
        LIST_EXCEPTION_BREAKPOINTS_REQUEST
      );
      if (responseBody && responseBody.typerefs) {
        enabledExceptionBreakpointTyperefs = responseBody.typerefs;
      }
    } else {
      enabledExceptionBreakpointTyperefs = Array.from(
        cachedExceptionBreakpoints.keys()
      );
    }
    const processedBreakpointInfos = mergeExceptionBreakpointInfos(
      exceptionBreakpointInfos,
      enabledExceptionBreakpointTyperefs
    );
    const selectExceptionOptions: vscode.QuickPickOptions = {
      placeHolder: nls.localize('select_exception_text'),
      matchOnDescription: true
    };
    const selectedException = await vscode.window.showQuickPick(
      processedBreakpointInfos,
      selectExceptionOptions
    );
    if (selectedException) {
      const selectBreakModeOptions: vscode.QuickPickOptions = {
        placeHolder: nls.localize('select_break_option_text'),
        matchOnDescription: true
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
        if (vscode.debug.activeDebugSession) {
          await vscode.debug.activeDebugSession.customRequest(
            EXCEPTION_BREAKPOINT_REQUEST,
            args
          );
        }
        updateExceptionBreakpointCache(selectedException);
      }
    }
  }
}

export function mergeExceptionBreakpointInfos(
  breakpointInfos: ExceptionBreakpointItem[],
  enabledBreakpointTyperefs: string[]
): ExceptionBreakpointItem[] {
  const processedBreakpointInfos: ExceptionBreakpointItem[] = [];
  if (enabledBreakpointTyperefs.length > 0) {
    for (let i = breakpointInfos.length - 1; i >= 0; i--) {
      if (enabledBreakpointTyperefs.indexOf(breakpointInfos[i].typeref) >= 0) {
        breakpointInfos[i].breakMode = EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS;
        breakpointInfos[i].description = `$(stop) ${nls.localize(
          'always_break_text'
        )}`;
        processedBreakpointInfos.unshift(breakpointInfos[i]);
        breakpointInfos.splice(i, 1);
      }
    }
  }
  return processedBreakpointInfos.concat(breakpointInfos);
}

export function updateExceptionBreakpointCache(
  selectedException: ExceptionBreakpointItem
) {
  if (
    selectedException.breakMode === EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS &&
    !cachedExceptionBreakpoints.has(selectedException.typeref)
  ) {
    cachedExceptionBreakpoints.set(
      selectedException.typeref,
      selectedException
    );
  } else if (
    selectedException.breakMode === EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER &&
    cachedExceptionBreakpoints.has(selectedException.typeref)
  ) {
    cachedExceptionBreakpoints.delete(selectedException.typeref);
  }
}

export function getExceptionBreakpointCache(): Map<
  string,
  ExceptionBreakpointItem
> {
  return cachedExceptionBreakpoints;
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
  const isvAuthWatcher = vscode.workspace.createFileSystemWatcher(
    '**/.sfdx/sfdx-config.json'
  );
  isvAuthWatcher.onDidChange(uri => notifyIsvAuthChanged());
  isvAuthWatcher.onDidCreate(uri => notifyIsvAuthChanged());
  isvAuthWatcher.onDidDelete(uri => notifyIsvAuthChanged());
  return vscode.Disposable.from(clsWatcher, trgWatcher, isvAuthWatcher);
}

function notifyDebuggerSessionFileChanged(): void {
  if (vscode.debug.activeDebugSession) {
    vscode.debug.activeDebugSession.customRequest(HOTSWAP_REQUEST);
  }
}

async function notifyIsvAuthChanged() {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const forceConfig = await new ForceConfigGet().getConfig(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      SFDX_CONFIG_ISV_DEBUGGER_SID,
      SFDX_CONFIG_ISV_DEBUGGER_URL
    );
    const isvDebuggerSid = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_SID);
    const isvDebuggerUrl = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_URL);
    if (
      typeof isvDebuggerSid !== 'undefined' &&
      typeof isvDebuggerUrl !== 'undefined'
    ) {
      // set auth context
      GlobalCliEnvironment.environmentVariables.set(
        ENV_SFDX_DEFAULTUSERNAME,
        isvDebuggerSid
      );
      GlobalCliEnvironment.environmentVariables.set(
        ENV_SFDX_INSTANCE_URL,
        isvDebuggerUrl
      );
      console.log(
        'Configured SFDX_DEFAULTUSERNAME and SFDX_INSTANCE_URL for ISV Project Authentication'
      );
      return;
    }
  }

  // reset any auth
  GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_DEFAULTUSERNAME);
  GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_INSTANCE_URL);
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
  notifyIsvAuthChanged();
}

export function deactivate() {
  console.log('Apex Debugger Extension Deactivated');
}
