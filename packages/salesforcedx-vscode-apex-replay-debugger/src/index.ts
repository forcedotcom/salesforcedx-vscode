/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  breakpointUtil,
  LineBreakpointEventArgs
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/breakpoints';
import {
  DEBUGGER_TYPE,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  LAST_OPENED_LOG_FOLDER_KEY,
  LAST_OPENED_LOG_KEY,
  LINE_BREAKPOINT_INFO_REQUEST,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import * as path from 'path';
import * as pathExists from 'path-exists';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import {
  checkpointService,
  processBreakpointChangedForCheckpoints,
  sfdxCreateCheckpoints,
  sfdxToggleCheckpoint
} from './breakpoints/checkpointService';
import { launchFromLogFile } from './commands/launchFromLogFile';
import { nls } from './messages';
import { telemetryService } from './telemetry';
let extContext: vscode.ExtensionContext;

export enum VSCodeWindowTypeEnum {
  Error = 1,
  Informational = 2,
  Warning = 3
}

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

function registerCommands(checkpointsEnabled: boolean): vscode.Disposable {
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
        updateLastOpened(extContext, fileUris[0].fsPath);
        return fileUris[0].fsPath;
      }
    }
  );
  const launchFromLogFileCmd = vscode.commands.registerCommand(
    'sfdx.launch.replay.debugger.logfile',
    editorUri => {
      let logFile: string | undefined;
      if (!editorUri) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          editorUri = editor.document.uri;
        }
      }
      if (editorUri) {
        logFile = editorUri.fsPath;
        updateLastOpened(extContext, editorUri.fsPath);
      }
      return launchFromLogFile(logFile);
    }
  );
  const launchFromLastLogFileCmd = vscode.commands.registerCommand(
    'sfdx.launch.replay.debugger.last.logfile',
    lastLogFileUri => {
      const lastOpenedLog = extContext.workspaceState.get<string>(
        LAST_OPENED_LOG_KEY
      );
      return launchFromLogFile(lastOpenedLog);
    }
  );

  if (checkpointsEnabled) {
    const sfdxCreateCheckpointsCmd = vscode.commands.registerCommand(
      'sfdx.create.checkpoints',
      sfdxCreateCheckpoints
    );
    const sfdxToggleCheckpointCmd = vscode.commands.registerCommand(
      'sfdx.toggle.checkpoint',
      sfdxToggleCheckpoint
    );

    return vscode.Disposable.from(
      promptForLogCmd,
      launchFromLogFileCmd,
      launchFromLastLogFileCmd,
      sfdxCreateCheckpointsCmd,
      sfdxToggleCheckpointCmd
    );
  } else {
    return vscode.Disposable.from(
      promptForLogCmd,
      launchFromLogFileCmd,
      launchFromLastLogFileCmd
    );
  }
}

export function updateLastOpened(
  extensionContext: vscode.ExtensionContext,
  logPath: string
) {
  extensionContext.workspaceState.update(LAST_OPENED_LOG_KEY, logPath);
  extensionContext.workspaceState.update(
    LAST_OPENED_LOG_FOLDER_KEY,
    path.dirname(logPath)
  );
}

export async function getDebuggerType(
  session: vscode.DebugSession
): Promise<string> {
  let type = session.type;
  if (type === LIVESHARE_DEBUGGER_TYPE) {
    type = await session.customRequest(LIVESHARE_DEBUG_TYPE_REQUEST);
  }
  return type;
}

function registerDebugHandlers(): vscode.Disposable {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(
    async event => {
      if (event && event.session) {
        const type = await getDebuggerType(event.session);
        if (
          type === DEBUGGER_TYPE &&
          event.event === GET_LINE_BREAKPOINT_INFO_EVENT
        ) {
          console.log('in registerDebugHandlers, getting line breakpoint info');
          const sfdxApex = vscode.extensions.getExtension(
            'salesforce.salesforcedx-vscode-apex'
          );
          if (sfdxApex && sfdxApex.exports) {
            const lineBpInfo = await sfdxApex.exports.getLineBreakpointInfo();
            let fsPath: string | undefined;
            if (
              vscode.workspace.workspaceFolders &&
              vscode.workspace.workspaceFolders[0]
            ) {
              fsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            const config = vscode.workspace.getConfiguration();
            const checkpointsEnabled = config.get(
              'salesforcedx-vscode-apex-replay-debugger-checkpoints.enabled',
              false
            );
            const returnArgs: LineBreakpointEventArgs = {
              lineBreakpointInfo: lineBpInfo,
              // for the moment always send undefined if checkpoints aren't enabled.
              projectPath: checkpointsEnabled ? fsPath : undefined
            };
            event.session.customRequest(
              LINE_BREAKPOINT_INFO_REQUEST,
              returnArgs
            );
            console.log(
              'in registerDebugHandlers, retrieved line breakpoint info from language server'
            );
          }
        }
      }
    }
  );

  return vscode.Disposable.from(customEventHandler);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Apex Replay Debugger Extension Activated');

  // Telemetry
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent();

  extContext = context;

  // registerCommands needs the checkpoint configuration
  const config = vscode.workspace.getConfiguration();
  const checkpointsEnabled = config.get(
    'salesforcedx-vscode-apex-replay-debugger-checkpoints.enabled',
    false
  );

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:replay_debugger_checkpoints_enabled',
    checkpointsEnabled
  );

  const commands = registerCommands(checkpointsEnabled);
  const debugHandlers = registerDebugHandlers();
  const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
    'apex-replay',
    new DebugConfigurationProvider()
  );
  context.subscriptions.push(commands, debugHandlers, debugConfigProvider);

  // Don't create the checkpoint service or register the breakpoints event
  // if checkpoints aren't enabled
  if (checkpointsEnabled) {
    const checkpointsView = vscode.window.registerTreeDataProvider(
      'sfdx.force.view.checkpoint',
      checkpointService
    );
    context.subscriptions.push(checkpointsView);

    const breakpointsSub = vscode.debug.onDidChangeBreakpoints(
      processBreakpointChangedForCheckpoints
    );
    context.subscriptions.push(breakpointsSub);
    console.log(
      'in activate, added breakpointsSub to subscriptions, activation complete'
    );
  }
}

function getDialogStartingPath(): vscode.Uri | undefined {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    // If the user has already selected a document through getLogFileName then
    // use that path if it still exists.
    const lastOpenedLogFolder = extContext.workspaceState.get<string>(
      LAST_OPENED_LOG_FOLDER_KEY
    );
    if (lastOpenedLogFolder && pathExists.sync(lastOpenedLogFolder)) {
      return vscode.Uri.file(lastOpenedLogFolder);
    }
    // If lastOpenedLogFolder isn't defined or doesn't exist then use the
    // same directory that the SFDX download logs command would download to
    // if it exists.
    const sfdxCommandLogDir = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      '.sfdx',
      'tools',
      'debug',
      'logs'
    );
    if (pathExists.sync(sfdxCommandLogDir)) {
      return vscode.Uri.file(sfdxCommandLogDir);
    }
    // If all else fails, fallback to the .sfdx directory in the workspace
    return vscode.Uri.file(
      path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.sfdx')
    );
  }
}

export async function retrieveLineBreakpointInfo(): Promise<boolean> {
  const sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );
  if (sfdxApex && sfdxApex.exports) {
    let expired = false;
    let i = 0;
    while (!sfdxApex.exports.isLanguageClientReady() && !expired) {
      await imposeSlightDelay(100);
      if (i >= 30) {
        expired = true;
      }
      i++;
    }
    if (expired) {
      const errorMessage = nls.localize('language_client_not_ready');
      writeToDebuggerOutputWindow(
        errorMessage,
        true,
        VSCodeWindowTypeEnum.Error
      );
      return false;
    } else {
      const lineBpInfo = await sfdxApex.exports.getLineBreakpointInfo();
      if (lineBpInfo && lineBpInfo.length > 0) {
        console.log(nls.localize('line_breakpoint_information_success'));
        breakpointUtil.createMappingsFromLineBreakpointInfo(lineBpInfo);
        return true;
      } else {
        const errorMessage = nls.localize(
          'no_line_breakpoint_information_for_current_project'
        );
        writeToDebuggerOutputWindow(
          errorMessage,
          true,
          VSCodeWindowTypeEnum.Error
        );
        return true;
      }
    }
  } else {
    const errorMessage = nls.localize('session_language_server_error_text');
    writeToDebuggerOutputWindow(errorMessage, true, VSCodeWindowTypeEnum.Error);
    return false;
  }
}

function imposeSlightDelay(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
}

export function writeToDebuggerOutputWindow(
  output: string,
  showVSCodeWindow?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum
) {
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.channelService.appendLine(output);
    sfdxCoreExtension.exports.channelService.showChannelOutput();
  }
  if (showVSCodeWindow && vsCodeWindowType) {
    switch (vsCodeWindowType) {
      case VSCodeWindowTypeEnum.Error: {
        vscode.window.showErrorMessage(output);
        break;
      }
      case VSCodeWindowTypeEnum.Informational: {
        vscode.window.showInformationMessage(output);
        break;
      }
      case VSCodeWindowTypeEnum.Warning: {
        vscode.window.showWarningMessage(output);
        break;
      }
    }
  }
}

export function deactivate() {
  console.log('Apex Replay Debugger Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
}
