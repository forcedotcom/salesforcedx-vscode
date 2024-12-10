/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE, WorkspaceSettings } from '@salesforce/salesforcedx-apex-debugger/out/src';
import * as vscode from 'vscode';
import { nls } from '../messages';

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  private salesforceApexExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex');

  public static getConfig(folder: vscode.WorkspaceFolder | undefined) {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      userIdFilter: [],
      requestTypeFilter: [],
      entryPointFilter: '',
      salesforceProject: folder ? folder.uri.fsPath : '${workspaceRoot}'
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
    return this.asyncDebugConfig(folder, config).catch(async err => {
      return vscode.window.showErrorMessage(err.message, { modal: true }).then(() => undefined);
    });
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
        proxyUrl: workspaceConfig.get('http.proxy', '') as string,
        proxyStrictSSL: workspaceConfig.get('http.proxyStrictSSL', false) as boolean,
        proxyAuth: workspaceConfig.get('http.proxyAuthorization', '') as string,
        connectionTimeoutMs: workspaceConfig.get('salesforcedx-vscode-apex-debugger.connectionTimeoutMs')
      } as WorkspaceSettings;
    }

    if (this.salesforceApexExtension && this.salesforceApexExtension.exports) {
      await this.isLanguageClientReady();
      config.lineBreakpointInfo = await this.salesforceApexExtension.exports.getLineBreakpointInfo();
    }
    return config;
  }

  private async isLanguageClientReady() {
    let expired = false;
    let i = 0;
    while (
      this.salesforceApexExtension &&
      this.salesforceApexExtension.exports &&
      !this.salesforceApexExtension.exports.languageClientUtils.getStatus().isReady() &&
      !expired
    ) {
      if (this.salesforceApexExtension.exports.languageClientUtils.getStatus().failedToInitialize()) {
        throw Error(this.salesforceApexExtension.exports.languageClientUtils.getStatus().getStatusMessage());
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
