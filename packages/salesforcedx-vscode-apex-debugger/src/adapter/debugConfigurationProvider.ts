/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE, WorkspaceSettings } from '@salesforce/salesforcedx-apex-debugger';
import * as vscode from 'vscode';
import { getActiveApexExtension } from '../context/apexExtension';
import { nls } from '../messages';

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  public static getConfig(folder: vscode.WorkspaceFolder | undefined): vscode.DebugConfiguration {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      userIdFilter: [],
      requestTypeFilter: [],
      entryPointFilter: '',
      salesforceProject: folder ? folder.uri.fsPath : '${workspaceRoot}'
    };
  }

  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig(folder)];
  }

  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    return this.asyncDebugConfig(folder, config).catch(async err =>
      vscode.window.showErrorMessage(err.message, { modal: true }).then(() => undefined)
    );
  }

  private async asyncDebugConfig(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration
  ): Promise<vscode.DebugConfiguration | undefined> {
    config.name = config.name || nls.localize('config_name_text');
    config.type = config.type || DEBUGGER_TYPE;
    config.request = config.request || DEBUGGER_LAUNCH_TYPE;
    if (config.userIdFilter === undefined) {
      config.userIdFilter = [];
    }
    if (config.requestTypeFilter === undefined) {
      config.requestTypeFilter = [];
    }
    if (config.entryPointFilter === undefined) {
      config.entryPointFilter = '';
    }
    config.salesforceProject = config.salesforceProject || (folder ? folder.uri.fsPath : '${workspaceRoot}');

    if (vscode.workspace) {
      const workspaceConfig = vscode.workspace.getConfiguration();
      config.workspaceSettings = {
        proxyUrl: workspaceConfig.get('http.proxy', ''),
        proxyStrictSSL: workspaceConfig.get('http.proxyStrictSSL', false),
        proxyAuth: workspaceConfig.get('http.proxyAuthorization', ''),
        connectionTimeoutMs: workspaceConfig.get('salesforcedx-vscode-apex-debugger.connectionTimeoutMs', 20000) // should match pjson default
      } satisfies WorkspaceSettings;
    }

    const salesforceApexExtension = await getActiveApexExtension();
    await this.isLanguageClientReady(salesforceApexExtension);
    config.lineBreakpointInfo = await salesforceApexExtension.exports.getLineBreakpointInfo();

    return config;
  }

  private async isLanguageClientReady(salesforceApexExtension: Awaited<ReturnType<typeof getActiveApexExtension>>) {
    let expired = false;
    let i = 0;
    while (!salesforceApexExtension.exports.languageClientManager.getStatus().isReady() && !expired) {
      if (salesforceApexExtension.exports.languageClientManager.getStatus().failedToInitialize()) {
        throw Error(salesforceApexExtension.exports.languageClientManager.getStatus().getStatusMessage());
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
