/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHash } from 'node:crypto';
import { ExtensionContext, extensions } from 'vscode';
import { TelemetryServiceProvider, TelemetryService } from '../services/telemetry';

// Type definition for the Core extension API
interface SalesforceVSCodeCoreApi {
  getSharedTelemetryUserId?: () => Promise<string>;
}

/**
 * Attempts to get the shared telemetry user ID from the Core extension.
 * Returns undefined if the Core extension is not available or doesn't have the method.
 */
export const getSharedTelemetryUserId = async (): Promise<string | undefined> => {
  try {
    const coreExtension = extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.getSharedTelemetryUserId) {
      return await coreExtension.exports.getSharedTelemetryUserId();
    }
  } catch (error) {
    // Silently ignore errors - we'll fall back to extension-specific storage
    console.log(`Failed to get shared telemetry user ID: ${String(error)}`);
  }
  return undefined;
};

/**
 * Creates a one-way hash of orgId and userId for telemetry compliance.
 * This ensures customer data cannot be decoded while maintaining user distinction.
 * The result is stored in the "webUserId" field for telemetry purposes.
 */
export const hashUserIdentifier = (orgId: string, userId: string): string =>
  createHash('sha256').update(`${orgId}-${userId}`).digest('hex');

/**
 * Ensures that all extensions (Core, Apex, etc.) use the updated hashed userID and webUserId in the webUserId field.
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
