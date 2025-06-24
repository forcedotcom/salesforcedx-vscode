/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';

let telemetryService: TelemetryServiceInterface | undefined;

export const setTelemetryService = (service: TelemetryServiceInterface) => {
  telemetryService = service;
};

export const getTelemetryService = (): TelemetryServiceInterface => {
  if (!telemetryService) {
    throw new Error('Telemetry service not initialized');
  }
  return telemetryService;
};
