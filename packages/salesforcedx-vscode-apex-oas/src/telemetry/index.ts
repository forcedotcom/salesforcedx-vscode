/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

let telemetryService: any;

export const getTelemetryService = (): any => {
  telemetryService ??= getTelemetryServiceFromCore();
  return telemetryService;
};

export const setTelemetryService = (service: any): void => {
  telemetryService = service;
};

const getTelemetryServiceFromCore = (): any => {
  const coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');
  if (coreExtension?.exports) {
    const telemetryServiceFromCore = coreExtension.exports.services?.TelemetryService;
    if (telemetryServiceFromCore) {
      return telemetryServiceFromCore.getInstance();
    }
  }
  throw new Error('Unable to get telemetry service from core extension');
};
