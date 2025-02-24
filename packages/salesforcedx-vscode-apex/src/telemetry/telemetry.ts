/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ServiceProvider, ServiceType, TelemetryServiceInterface } from '@salesforce/vscode-service-provider';

export const getTelemetryService = async (): Promise<TelemetryServiceInterface> => {
  return ServiceProvider.getService(ServiceType.Telemetry, 'salesforcedx-vscode-apex');
};

export type OASGenerationCommandProperties = {
  isClass: string;
  overwrite: string;
};

export type OASGenerationCommandMeasure = {
  llmCallCount?: number;
  generationSize?: number;
  generationDuration?: number;
  documentTtlProblems?: number;
  documentErrors?: number;
  documentWarnings?: number;
  documentInfo?: number;
  documentHints?: number;
};
