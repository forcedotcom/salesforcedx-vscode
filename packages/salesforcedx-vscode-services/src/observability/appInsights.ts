/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionMode, workspace } from 'vscode';

/** instrumention key / connection string for test-otel-effect */
export const DEFAULT_AI_CONNECTION_STRING =
  'InstrumentationKey=f5cbbeba-e06b-4657-b99c-62024c9d36bf;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=1485438c-5495-43dc-8c0a-b51e860b6cba';

let _extensionMode: ExtensionMode | undefined; // eslint-disable-line functional/no-let

/**
 * Set the extension mode for telemetry gating.
 * Called during extension activation to enable dev mode checks.
 */
export const setExtensionMode = (mode: ExtensionMode): void => {
  _extensionMode = mode;
};

export const isTelemetryExtensionConfigurationEnabled = (): boolean => {
  // Check VS Code telemetry settings
  const enabled =
    workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all') !== 'off' &&
    // on the web, no core extension is ever installed so we can't consult the config
    (process.env.ESBUILD_PLATFORM === 'web' ||
      workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('telemetry.enabled', false));

  if (!enabled) {
    return false;
  }

  // Block dev mode telemetry by default to prevent polluting production data
  // Can be overridden with salesforcedx-vscode-core.telemetry.allowDevMode setting
  const isDevMode = _extensionMode !== undefined && _extensionMode !== ExtensionMode.Production;
  if (isDevMode) {
    const allowDevMode = workspace
      .getConfiguration('salesforcedx-vscode-core')
      .get<boolean>('telemetry.allowDevMode', false);
    return allowDevMode;
  }

  return true;
};
