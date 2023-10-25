/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { soqlBuilderToggle, soqlOpenNew } from './commands';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { startLanguageClient, stopLanguageClient } from './lspClient/client';
import { QueryDataViewService } from './queryDataView/queryDataViewService';
import { workspaceContext, channelService } from './sfdx';
import { startTelemetry, stopTelemetry } from './telemetry';

export async function activate(
  extensionContext: vscode.ExtensionContext
): Promise<any> {
  const extensionHRStart = process.hrtime();
  extensionContext.subscriptions.push(
    SOQLEditorProvider.register(extensionContext)
  );
  QueryDataViewService.register(extensionContext);
  await workspaceContext.initialize(extensionContext);

  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.open.new', soqlOpenNew)
  );
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.toggle', soqlBuilderToggle)
  );

  await startLanguageClient(extensionContext);
  await startTelemetry(extensionContext, extensionHRStart).catch();
  console.log('SOQL Extension Activated');
  return { workspaceContext, channelService };
}

export function deactivate(): Thenable<void> | undefined {
  void stopTelemetry().catch();
  return stopLanguageClient();
}
