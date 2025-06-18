/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE } from '@salesforce/salesforcedx-apex-replay-debugger';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getApexExtension } from '../utils/externalExtensionUtils';

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  public static getConfig(logFile?: string, stopOnEntry: boolean = true): vscode.DebugConfiguration {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: logFile ? logFile : '${command:AskForLogFileName}',
      stopOnEntry,
      trace: true
    };
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
    return this.asyncDebugConfig(config).catch(async err =>
      vscode.window.showErrorMessage(err.message, { modal: true }).then(() => undefined)
    );
  }

  private async asyncDebugConfig(config: vscode.DebugConfiguration): Promise<vscode.DebugConfiguration | undefined> {
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

    if (vscode.workspace.workspaceFolders?.[0]) {
      config.projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    const apexExtension = await getApexExtension();
    if (apexExtension?.exports) {
      await this.isLanguageClientReady();
      config.lineBreakpointInfo = await apexExtension.exports.getLineBreakpointInfo();
    }
    return config;
  }

  private async isLanguageClientReady() {
    let expired = false;
    let i = 0;
    const apexExtension = await getApexExtension();
    while (!apexExtension.exports.languageClientManager.getStatus().isReady() && !expired) {
      if (apexExtension.exports.languageClientManager.getStatus().failedToInitialize()) {
        throw Error(apexExtension.exports.languageClientManager.getStatus().getStatusMessage());
      }

      await new Promise(r => setTimeout(r, 100));
      if (i >= 30) {
        expired = true;
      }
      i++;
    }
    if (expired) {
      throw Error(nls.localize('language_client_not_ready'));
    }
  }
}
