/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { startLanguageClient, stopLanguageClient } from './lspClient/client';
import { soqlBuilderToggle, soqlOpenNew } from './commands';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { QueryDataViewService } from './queryDataView/queryDataViewService';
import { workspaceContext, channelService } from './sfdx';
import { startTelemetry, stopTelemetry } from './telemetry';

export async function activate(context: vscode.ExtensionContext): Promise<any> {
  const extensionHRStart = process.hrtime();
  context.subscriptions.push(SOQLEditorProvider.register(context));
  QueryDataViewService.register(context);
  await workspaceContext.initialize(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.open.new', soqlOpenNew)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.toggle', soqlBuilderToggle)
  );

  await startLanguageClient(context);
  startTelemetry(context, extensionHRStart).catch();
  console.log('SOQL Extension Activated');
  return { workspaceContext, channelService };
}

export function deactivate(): Thenable<void> | undefined {
  stopTelemetry().catch();
  return stopLanguageClient();
}
