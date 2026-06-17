/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';
import { TelemetryServiceProvider, TelemetryService } from '../services/telemetry';

/**
 * Ensures that all extensions (Core, Apex, etc.) refresh their telemetry reporters so the next event
 * uses the latest identity values sourced from the services extension.
 */
export const updateUserIDOnTelemetryReporters = async (coreExtensionContext: ExtensionContext): Promise<void> => {
  console.log('Updating userID and WebID telemetry reporters for all extensions...');

  await Promise.allSettled(
    Array.from(TelemetryServiceProvider.instances.entries())
      .filter(
        ([, telemetryService]) => telemetryService instanceof TelemetryService && 'updateReporters' in telemetryService
      )
      .map(
        async ([extname, telemetryService]) =>
          await telemetryService.updateReporters(coreExtensionContext).catch((error: unknown) => {
            console.log(`Failed to update telemetry reporters for ${extname}:`, String(error));
          })
      )
  );
  console.log('Completed updating userID and WebID telemetry reporters for all extensions');
};
