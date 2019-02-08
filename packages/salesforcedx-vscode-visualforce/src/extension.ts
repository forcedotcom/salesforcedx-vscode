/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';

import { ExtensionContext, extensions } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { activate as activateVisualforceLanguageService } from './htmlMain';
import { telemetryService } from './telemetry';

export async function activate(context: ExtensionContext) {
  const extensionHRStart = process.hrtime();

  // Telemetry
  const sfdxCoreExtension = extensions.getExtension(
    'salesforce.salesforcedx-vscode-core'
  );

  let telemetryReporter: TelemetryReporter | undefined;
  if (sfdxCoreExtension) {
    telemetryReporter = sfdxCoreExtension.exports.telemetryService.getReporter();
  }

  activateVisualforceLanguageService(context, telemetryReporter);

  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
}

export function deactivate() {
  console.log('SFDX Visualforce Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
}
