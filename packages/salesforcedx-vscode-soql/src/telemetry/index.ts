/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const telemetryService = TelemetryService.getInstance();

export const startTelemetry = async (
  extensionContext: vscode.ExtensionContext,
  hrtime: [number, number]
): Promise<void> => {
  await telemetryService.initializeService(extensionContext);
  telemetryService.sendExtensionActivationEvent(hrtime);
};

export const stopTelemetry = (): Promise<void> => {
  telemetryService.sendExtensionDeactivationEvent();
  return Promise.resolve();
};

export type TelemetryModelJson = {
  fields: number;
  orderBy: number;
  limit: number;
  errors: number;
  unsupported: number;
};
