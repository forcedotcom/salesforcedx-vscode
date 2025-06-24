/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ActivationTracker } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { soqlBuilderToggle } from './commands/soqlBuilderToggle';
import { soqlOpenNew } from './commands/soqlFileCreate';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { startLanguageClient, stopLanguageClient } from './lspClient/client';
import { nls } from './messages';
import { QueryDataViewService } from './queryDataView/queryDataViewService';
import { workspaceContext, getActiveCoreExtension } from './sf';
import { telemetryService } from './telemetry';

export const activate = async (extensionContext: vscode.ExtensionContext): Promise<any> => {
  const ext = await getActiveCoreExtension();
  const channelService = ext.exports.services.ChannelService.getInstance(nls.localize('soql_channel_name'));

  await telemetryService.initializeService(extensionContext);
  channelService.appendLine(`SOQL Extension Initializing in mode ${extensionContext.extensionMode}`);
  const activationTracker = new ActivationTracker(extensionContext, telemetryService);

  extensionContext.subscriptions.push(SOQLEditorProvider.register(extensionContext));
  QueryDataViewService.register(extensionContext);
  await workspaceContext.initialize(extensionContext);

  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.open.new', soqlOpenNew),
    vscode.commands.registerCommand('soql.builder.toggle', soqlBuilderToggle)
  );

  await startLanguageClient(extensionContext);
  void activationTracker.markActivationStop();
  channelService.appendLine('SOQL Extension Activated');
  return { workspaceContext, channelService };
};

export const deactivate = (): Thenable<void> => {
  telemetryService.sendExtensionDeactivationEvent();
  return stopLanguageClient();
};
