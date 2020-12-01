/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode/out/src/telemetry';
import { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';

export const telemetryService = TelemetryService.getInstance();

export async function startTelemetry(
  context: vscode.ExtensionContext,
  hrtime: [number, number]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const extensionPackage = require(context.asAbsolutePath('./package.json'));
  await telemetryService.initializeService(
    context,
    extensionPackage.name,
    extensionPackage.aiKey,
    extensionPackage.version
  );
  await telemetryService.sendExtensionActivationEvent(hrtime);
}

export async function stopTelemetry(): Promise<void> {
  await telemetryService.sendExtensionDeactivationEvent();
}

export interface TelemetryModelJson extends JsonMap {
  fields: number;
  orderBy: number;
  limit: number;
  errors: JsonMap[];
  unsupported: string[];
}
