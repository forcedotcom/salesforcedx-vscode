/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE } from '@salesforce/salesforcedx-apex-replay-debugger';
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { nls } from '../messages';

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  private salesforceApexExtension = vscode.extensions.getExtension<ApexVSCodeApi>(
    'salesforce.salesforcedx-vscode-apex'
  );
  public static getConfig(logFile?: string, stopOnEntry: boolean = true): vscode.DebugConfiguration {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: logFile ?? '${command:AskForLogFileName}',
      stopOnEntry,
      trace: true
    };
  }

  public provideDebugConfigurations(
    _folder: vscode.WorkspaceFolder | undefined,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig()];
  }

  public resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    return this.asyncDebugConfig(config).catch(async err =>
      vscode.window.showErrorMessage(err.message, { modal: true }).then(() => undefined)
    );
  }

  private async asyncDebugConfig(config: vscode.DebugConfiguration): Promise<vscode.DebugConfiguration | undefined> {
    config.name = config.name || nls.localize('config_name_text');
    config.type = config.type || DEBUGGER_TYPE;
    config.request = config.request || DEBUGGER_LAUNCH_TYPE;
    config.logFile = config.logFile ?? '${command:AskForLogFileName}';
    if (config.stopOnEntry === undefined) {
      config.stopOnEntry = true;
    }
    if (config.trace === undefined) {
      config.trace = true;
    }

    if (vscode.workspace?.workspaceFolders?.[0]) {
      config.projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    if (!this.salesforceApexExtension?.isActive) {
      await this.salesforceApexExtension?.activate();
    }
    if (this.salesforceApexExtension?.exports) {
      await this.isLanguageClientReady();
      config.lineBreakpointInfo = await this.salesforceApexExtension.exports.getLineBreakpointInfo();
    }

    // Handle log file reading for web compatibility
    if (config.logFile && config.logFile !== '${command:AskForLogFileName}') {
      // Direct file path provided
      try {
        config.logFileContents = await readFile(config.logFile);
        config.logFilePath = config.logFile;
        config.logFileName = getBasename(config.logFile);
        // Remove logFile since we're now using logFileContents
        delete config.logFile;
      } catch (error) {
        console.error('Failed to read log file:', error);
        throw new Error(`Failed to read log file: ${error}`);
      }
    } else if (config.logFile === '${command:AskForLogFileName}') {
      // User needs to select a file
      try {
        const logFilePath = await vscode.commands.executeCommand('extension.replay-debugger.getLogFileName');
        if (logFilePath && typeof logFilePath === 'string') {
          config.logFileContents = await readFile(logFilePath);
          config.logFilePath = logFilePath;
          config.logFileName = getBasename(logFilePath);
          // Remove logFile since we're now using logFileContents
          delete config.logFile;
        } else {
          throw new Error('No log file selected');
        }
      } catch (error) {
        console.error('Failed to read selected log file:', error);
        throw new Error(`Failed to read selected log file: ${error}`);
      }
    }

    return config;
  }

  private async isLanguageClientReady(): Promise<void> {
    if (!this.salesforceApexExtension?.exports) {
      throw new Error('Apex extension not available');
    }

    let expired = false;
    let i = 0;
    while (!this.salesforceApexExtension.exports.languageClientManager.getStatus().isReady() && !expired) {
      if (this.salesforceApexExtension.exports.languageClientManager.getStatus().failedToInitialize()) {
        throw Error(this.salesforceApexExtension.exports.languageClientManager.getStatus().getStatusMessage());
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      if (i >= 30) {
        expired = true;
      }
      i++;
    }
    if (expired) {
      throw new Error(nls.localize('language_client_not_ready'));
    }
  }
}

// Helper function to extract filename from path (web-compatible)
const getBasename = (filePath: string): string => {
  // Handle both forward and backward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts.at(-1) ?? filePath;
};
