/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LineBreakpointEventArgs } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/breakpoints';
import {
  DEBUGGER_LAUNCH_TYPE,
  DEBUGGER_TYPE
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import * as vscode from 'vscode';
import { nls } from '../messages';

export class DebugConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  public static getConfig(logFile?: string) {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: logFile ? logFile : '${command:AskForLogFileName}',
      stopOnEntry: true,
      trace: true
    } as vscode.DebugConfiguration;
  }

  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig()];
  }

  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    config.name = config.name || nls.localize('config_name_text');
    config.type = config.type || DEBUGGER_TYPE;
    config.request = config.request || DEBUGGER_LAUNCH_TYPE;
    config.logFile = config.logFile || '${command:AskForLogFileName}';
    if (config.stopOnEntry === undefined) {
      config.stopOnEntry = true;
    }
    if (config.trace === undefined) {
      config.trace = true;
    }

    const sfdxApex = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex'
    );
    if (sfdxApex && sfdxApex.exports) {
      const lineBpInfo = sfdxApex.exports.getLineBreakpointInfo();
      let fsPath: string | undefined;
      if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0]
      ) {
        fsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      }
      /* const config = vscode.workspace.getConfiguration();
      const checkpointsEnabled = config.get(
        'salesforcedx-vscode-apex-replay-debugger-checkpoints.enabled',
        false
      ); */
      const returnArgs: LineBreakpointEventArgs = {
        lineBreakpointInfo: lineBpInfo,
        // for the moment always send undefined if checkpoints aren't enabled.
        projectPath: fsPath !== null ? fsPath : undefined
      };

      config.__privateData = returnArgs;
    }
    return config;
  }
}
