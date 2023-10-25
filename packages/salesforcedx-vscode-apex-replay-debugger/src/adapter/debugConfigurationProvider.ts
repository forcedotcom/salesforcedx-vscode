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
  private sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );
  public static getConfig(logFile?: string, stopOnEntry: boolean = true) {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: logFile ? logFile : '${command:AskForLogFileName}',
      stopOnEntry,
      trace: true
    } as vscode.DebugConfiguration;
  }

  public provideDebugConfigurations(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    folder: vscode.WorkspaceFolder | undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig()];
  }

  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    return this.asyncDebugConfig(config).catch(async error => {
      return vscode.window
        .showErrorMessage(error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown', { modal: true })
        .then(() => undefined);
    });
  }

  private async asyncDebugConfig(
    config: vscode.DebugConfiguration
  ): Promise<vscode.DebugConfiguration | undefined> {
    config.name = config.name || nls.localize('config_name_text');
    config.type = config.type || DEBUGGER_TYPE;
    config.request = config.request || DEBUGGER_LAUNCH_TYPE;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    if (this.sfdxApex && this.sfdxApex.exports) {
      await this.isLanguageClientReady();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      config.lineBreakpointInfo = await this.sfdxApex.exports.getLineBreakpointInfo();
    }
    return config;
  }

  private async isLanguageClientReady() {
    let expired = false;
    let i = 0;
    while (
      this.sfdxApex &&
      this.sfdxApex.exports &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      !this.sfdxApex.exports.languageClientUtils.getStatus().isReady() &&
      !expired
    ) {
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.sfdxApex.exports.languageClientUtils
          .getStatus()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          .failedToInitialize()
      ) {
        throw Error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.sfdxApex.exports.languageClientUtils
            .getStatus()
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            .getStatusMessage()
        );
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
