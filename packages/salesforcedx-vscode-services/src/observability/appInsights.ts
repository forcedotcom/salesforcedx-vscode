/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspace } from 'vscode';

/** instrumention key / connection string for test-otel-effect */
export const DEFAULT_AI_CONNECTION_STRING =
  'InstrumentationKey=f5cbbeba-e06b-4657-b99c-62024c9d36bf;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=1485438c-5495-43dc-8c0a-b51e860b6cba';

export const isTelemetryExtensionConfigurationEnabled = (): boolean =>
  // TODO: should we consult the CLI's telemetry preference?
  workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all') !== 'off' &&
  workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('telemetry.enabled', true);
