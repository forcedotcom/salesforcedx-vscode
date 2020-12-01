/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode/out/src/context';
import * as vscode from 'vscode';
import { startLanguageClient, stopLanguageClient } from './client/client';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { QueryDataViewService } from './queryDataView/queryDataViewService';
import { startTelemetry, stopTelemetry } from './telemetry';

export function activate(context: vscode.ExtensionContext): void {
  console.log('SOQL Extension Activated');
  const extensionHRStart = process.hrtime();
  context.subscriptions.push(SOQLEditorProvider.register(context));
  QueryDataViewService.register(context);
  WorkspaceContextUtil.getInstance().initialize(context);
  startLanguageClient(context);
  startTelemetry(context, extensionHRStart).catch();
}

export function deactivate(): Thenable<void> | undefined {
  stopTelemetry().catch();
  return stopLanguageClient();
}
