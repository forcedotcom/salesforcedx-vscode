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
    return config;
  }
}
