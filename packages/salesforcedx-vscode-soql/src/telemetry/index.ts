/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';

export const telemetryService = TelemetryService.getInstance();

export async function startTelemetry(
  extensionContext: vscode.ExtensionContext,
  hrtime: [number, number]
): Promise<void> {
  const { name, aiKey, version } = extensionContext.extension.packageJSON;
  const extensionPackage = {
    name,
    aiKey,
    version
  };

  await telemetryService.initializeService(
    extensionContext,
    extensionPackage.name,
    extensionPackage.aiKey,
    extensionPackage.version
  );
  telemetryService.sendExtensionActivationEvent(hrtime);
}

export async function stopTelemetry(): Promise<void> {
  telemetryService.sendExtensionDeactivationEvent();
}

export interface TelemetryModelJson extends JsonMap {
  fields: number;
  orderBy: number;
  limit: number;
  errors: number;
  unsupported: number;
}
