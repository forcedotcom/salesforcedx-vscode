/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { startLanguageClient, stopLanguageClient } from './client/client';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { telemetryService } from './telemetry';

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

function startTelemetry(hrstart: [number, number]): void {
  // Telemetry
  const sfdxCoreExtension = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-core'
  );

  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent(hrstart);
}

function stopTelemetry(): void {
  telemetryService.sendExtensionDeactivationEvent();
}
