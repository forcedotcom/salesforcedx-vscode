/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { startLanguageClient, stopLanguageClient } from './client/client';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { startTelemetry, stopTelemetry } from './telemetry';

export function activate(context: vscode.ExtensionContext): void {
  const extensionHRStart = process.hrtime();
  context.subscriptions.push(SOQLEditorProvider.register(context));
  startLanguageClient(context);
  startTelemetry(extensionHRStart);
}

export function deactivate(): Thenable<void> | undefined {
  stopTelemetry();
  return stopLanguageClient();
}
