/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DEBUGGER_TYPE,
  WorkspaceSettings
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import * as vscode from 'vscode';

export class DebugConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  private sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );

  public static getConfig(folder: vscode.WorkspaceFolder | undefined) {
    return {
      name: 'Launch Apex Debugger',
      type: DEBUGGER_TYPE,
      request: 'launch',
      userIdFilter: [],
      requestTypeFilter: [],
      entryPointFilter: '',
      sfdxProject: folder ? folder.uri.fsPath : '${workspaceRoot}'
    } as vscode.DebugConfiguration;
  }

  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig(folder)];
  }

  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    return this.asyncDebugConfig(config).catch(async err => {
      return vscode.window
        .showErrorMessage(err.message, { modal: true })
        .then(x => undefined);
    });
  }

  private async asyncDebugConfig(
    config: vscode.DebugConfiguration
  ): Promise<vscode.DebugConfiguration | undefined> {
    if (vscode.workspace) {
      const workspaceConfig = vscode.workspace.getConfiguration();
      config.workspaceSettings = {
        proxyUrl: workspaceConfig.get('http.proxy', '') as string,
        proxyStrictSSL: workspaceConfig.get(
          'http.proxyStrictSSL',
          false
        ) as boolean,
        proxyAuth: workspaceConfig.get('http.proxyAuthorization', '') as string,
        connectionTimeoutMs: workspaceConfig.get(
          'salesforcedx-vscode-apex-debugger.connectionTimeoutMs'
        )
      } as WorkspaceSettings;
    }

    if (this.sfdxApex && this.sfdxApex.exports) {
      await this.isLanguageClientReady();
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
      !this.sfdxApex.exports.isLanguageClientReady() &&
      !expired
    ) {
      await new Promise(r => setTimeout(r, 100));
      if (i >= 30) {
        expired = true;
      }
      i++;
    }
    if (expired) {
      throw Error('Server is not ready Luis!'); // nls.localize('language_client_not_ready'));
    }
  }
}
