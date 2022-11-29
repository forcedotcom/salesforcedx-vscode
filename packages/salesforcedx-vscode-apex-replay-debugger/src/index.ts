/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  MetricError,
  MetricLaunch
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src';
import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/breakpoints';
import {
  DEBUGGER_TYPE,
  LAST_OPENED_LOG_FOLDER_KEY,
  LAST_OPENED_LOG_KEY,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE,
  SEND_METRIC_ERROR_EVENT,
  SEND_METRIC_LAUNCH_EVENT
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDialogStartingPath } from './activation/getDialogStartingPath';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import {
  CheckpointService,
  checkpointService,
  processBreakpointChangedForCheckpoints,
  sfdxToggleCheckpoint
} from './breakpoints/checkpointService';
import { channelService } from './channels';
import { launchFromLogFile } from './commands/launchFromLogFile';
import { setupAndDebugTests } from './commands/quickLaunch';
import { workspaceContext } from './context';
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

function registerCommands(): vscode.Disposable {
  const dialogStartingPathUri = getDialogStartingPath(extContext);
  const promptForLogCmd = vscode.commands.registerCommand(
    'extension.replay-debugger.getLogFileName',
    async config => {
      const fileUris:
        | vscode.Uri[]
        | undefined = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        defaultUri: dialogStartingPathUri
      });
      if (fileUris && fileUris.length === 1) {
        updateLastOpened(extContext, fileUris[0].fsPath);
        return fileUris[0].fsPath;
      }
    }
  );
  const launchFromLogFileCmd = vscode.commands.registerCommand(
    'sfdx.launch.replay.debugger.logfile',
    (editorUri: vscode.Uri) => {
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

  const launchFromLogFilePathCmd = vscode.commands.registerCommand(
    'sfdx.launch.replay.debugger.logfile.path',
    logFilePath => {
      if (logFilePath) {
        launchFromLogFile(logFilePath, true);
      }
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

  const sfdxCreateCheckpointsCmd = vscode.commands.registerCommand(
    'sfdx.create.checkpoints',
    CheckpointService.sfdxCreateCheckpoints
  );
  const sfdxToggleCheckpointCmd = vscode.commands.registerCommand(
    'sfdx.toggle.checkpoint',
    sfdxToggleCheckpoint
  );

  return vscode.Disposable.from(
    promptForLogCmd,
    launchFromLogFileCmd,
    launchFromLogFilePathCmd,
    launchFromLastLogFileCmd,
    sfdxCreateCheckpointsCmd,
    sfdxToggleCheckpointCmd
  );
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
        if (type !== DEBUGGER_TYPE) {
          return;
        }

        if (event.event === SEND_METRIC_LAUNCH_EVENT && event.body) {
          const metricLaunchArgs = event.body as MetricLaunch;
          telemetryService.sendLaunchEvent(
            metricLaunchArgs.logSize.toString(),
            metricLaunchArgs.error.subject
          );
        } else if (event.event === SEND_METRIC_ERROR_EVENT && event.body) {
          const metricErrorArgs = event.body as MetricError;
          telemetryService.sendErrorEvent(
            metricErrorArgs.subject,
            metricErrorArgs.callstack
          );
        }
      }
    }
  );

  return vscode.Disposable.from(customEventHandler);
}

export async function activate(extensionContext: vscode.ExtensionContext) {
  console.log('Apex Replay Debugger Extension Activated');
  const extensionHRStart = process.hrtime();

  extContext = extensionContext;
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
  const breakpointsSub = vscode.debug.onDidChangeBreakpoints(
    processBreakpointChangedForCheckpoints
  );

  // Workspace Context
  await workspaceContext.initialize(extensionContext);

  // Debug Tests command
  const debugTests = vscode.commands.registerCommand(
    'sfdx.force.test.view.debugTests',
    async test => {
      await setupAndDebugTests(test.name);
    }
  );

  // Debug Single Test command
  const debugTest = vscode.commands.registerCommand(
    'sfdx.force.test.view.debugSingleTest',
    async test => {
      const name = test.name.split('.');
      await setupAndDebugTests(name[0], name[1]);
    }
  );

  extensionContext.subscriptions.push(
    commands,
    debugHandlers,
    debugConfigProvider,
    checkpointsView,
    breakpointsSub,
    debugTests,
    debugTest
  );

  // Telemetry
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
}

export async function retrieveLineBreakpointInfo(): Promise<boolean> {
  const sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );
  if (sfdxApex && sfdxApex.exports) {
    let expired = false;
    let i = 0;
    while (
      !sfdxApex.exports.languageClientUtils.getStatus().isReady() &&
      !expired
    ) {
      if (
        sfdxApex.exports.languageClientUtils.getStatus().failedToInitialize()
      ) {
        throw Error(
          sfdxApex.exports.languageClientUtils.getStatus().getStatusMessage()
        );
      }

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
  channelService.appendLine(output);
  channelService.showChannelOutput();
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
