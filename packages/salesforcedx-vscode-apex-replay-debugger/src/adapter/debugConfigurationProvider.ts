/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
    return this.asyncDebugConfig(config).catch(async err => {
      return vscode.window.showErrorMessage(err.message).then(x => undefined);
    });
  }

  private async asyncDebugConfig(
    config: vscode.DebugConfiguration
  ): Promise<vscode.DebugConfiguration | undefined> {
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

    if (
      vscode.workspace &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      config.projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    const sfdxApex = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex'
    );
    if (sfdxApex && sfdxApex.exports) {
      config.lineBreakpointInfo = await sfdxApex.exports.getLineBreakpointInfo();
    }

    return config;
  }
}
