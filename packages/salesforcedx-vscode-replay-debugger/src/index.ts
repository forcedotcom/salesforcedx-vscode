/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import { breakpointUtil } from './breakpoints';
import {
  checkpointService,
  processBreakpointChangedForCheckpoints
} from './breakpoints/checkpointService';
import {
  DEBUGGER_TYPE,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  LINE_BREAKPOINT_INFO_REQUEST
} from './constants';
import { nls } from './messages';

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
          console.log('in registerDebugHandlers, getting line breakpoint info');
          event.session.customRequest(
            LINE_BREAKPOINT_INFO_REQUEST,
            breakpointUtil.getRawLineBPInfo()
          );
        }
      }
    }
  );
  return vscode.Disposable.from(customEventHandler);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Apex Replay Debugger Extension Activated');
  const commands = registerCommands();
  const debugHandlers = registerDebugHandlers();
  const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
    'apex-replay',
    new DebugConfigurationProvider()
  );
  context.subscriptions.push(commands, debugHandlers, debugConfigProvider);

  console.log('in activate, getting line breakpoint info');
  if (!await retrieveLineBreakpointInfo()) {
    console.log(
      'in activate, did not retrieve line breakpoint info, returning'
    );
    // the error was already reported in the function, return
    return;
  }
  console.log('in activate, successfully retrieved line breakpoint info');

  const config = vscode.workspace.getConfiguration();
  const checkpointsEnabled = config.get(
    'salesforcedx-vscode-replay-debugger-checkpoints.enabled',
    false
  );

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:replay_debugger_checkpoints_enabled',
    checkpointsEnabled
  );

  // Don't create the checkpoint service or register the breakpoints event
  // if checkpoints aren't enabled
  if (checkpointsEnabled) {
    const checkpointsView = vscode.window.registerTreeDataProvider(
      'sfdx.force.view.checkpoint',
      checkpointService
    );
    context.subscriptions.push(checkpointsView);

    console.log('in activate, activating request service');
    if (!await checkpointService.activateRequestService()) {
      console.log('in activate, activating request service failed, returning');
      // the error was already reported in the function, return
      return;
    }
    console.log('in activate, successfully activated request service');

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
    return vscode.Uri.file(
      path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.sfdx')
    );
  }
}

async function retrieveLineBreakpointInfo(): Promise<boolean> {
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
      vscode.window.showErrorMessage(nls.localize('language_client_not_ready'));
      return false;
    } else {
      const lineBpInfo = await sfdxApex.exports.getLineBreakpointInfo();
      if (lineBpInfo && lineBpInfo.length > 0) {
        vscode.window.showInformationMessage(
          nls.localize('line_breakpoint_information_success')
        );
        breakpointUtil.createMappingsFromLineBreakpointInfo(lineBpInfo);
        return true;
      } else {
        vscode.window.showErrorMessage(
          nls.localize('no_line_breakpoint_information_for_current_project')
        );
        return true;
      }
    }
  } else {
    vscode.window.showErrorMessage(
      nls.localize('session_language_server_error_text')
    );
    return false;
  }
}

function imposeSlightDelay(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
}
export function deactivate() {
  console.log('Apex Replay Debugger Extension Deactivated');
}
