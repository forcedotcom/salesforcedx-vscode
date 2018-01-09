/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from '../messages';

export class DebugConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
      {
        name: nls.localize('config_name_text'),
        type: nls.localize('config_type_text'),
        request: nls.localize('config_request_type_text'),
        logFile: '${workspaceFolder}/${command:AskForLogFileName}',
        stopOnEntry: true,
        trace: true
      } as vscode.DebugConfiguration
    ];
  }

  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    config.name = config.name || nls.localize('config_name_text');
    config.type = config.type || nls.localize('config_type_text');
    config.request = config.request || nls.localize('config_request_type_text');
    config.logFile =
      config.logFile || '${workspaceFolder}/${command:AskForLogFileName}';
    if (config.stopOnEntry === undefined) {
      config.stopOnEntry = true;
    }
    if (config.trace === undefined) {
      config.trace = true;
    }
    return config;
  }
}
