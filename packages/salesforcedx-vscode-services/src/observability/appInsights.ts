/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { workspace } from 'vscode';
import { ChannelService } from '../vscode/channelService';

/** instrumention key / connection string for test-otel-effect */
export const DEFAULT_AI_CONNECTION_STRING =
  'InstrumentationKey=f5cbbeba-e06b-4657-b99c-62024c9d36bf;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=1485438c-5495-43dc-8c0a-b51e860b6cba';

export const isTelemetryExtensionConfigurationEnabled = (): boolean => {
  // TODO: should we consult the CLI's telemetry preference?
  const enabled =
    workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all') !== 'off' &&
    workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('telemetry.enabled', false);
  Effect.runSync(
    Effect.gen(function* () {
      const channelService = yield* ChannelService;
      yield* channelService.appendToChannel('checking telemetry configuration');
      yield* channelService.appendToChannel(
        `telemetryLevel: ${workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all')}`
      );
      yield* channelService.appendToChannel(
        `telemetry.enabled: ${workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('telemetry.enabled', false)}`
      );
    }).pipe(Effect.provide(ChannelService.Default))
  );
  return enabled;
};
