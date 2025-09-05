/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHash } from 'node:crypto';
import { ExtensionContext, extensions } from 'vscode';

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
 * Refreshes telemetry reporters for ALL extension instances when org authorization changes.
 * This ensures that all extensions (Core, Apex, etc.) use the updated hashed user ID in the webUserId field.
 */
export const refreshAllExtensionReporters = async (coreExtensionContext: ExtensionContext): Promise<void> => {
  // Import here to avoid circular dependency
  const { TelemetryServiceProvider, TelemetryService } = await import('../services/telemetry.js');

  console.log('Refreshing telemetry reporters for all extensions...');

  const refreshPromises: Promise<void>[] = [];

  // Refresh reporters for all registered extension instances
  for (const [extensionName, telemetryService] of TelemetryServiceProvider.instances) {
    if (telemetryService instanceof TelemetryService && 'refreshReporters' in telemetryService) {
      const refreshPromise = telemetryService.refreshReporters(coreExtensionContext).catch((error: unknown) => {
        console.log(`Failed to refresh telemetry reporters for ${extensionName}:`, String(error));
      });
      refreshPromises.push(refreshPromise);
    }
  }

  // Wait for all refresh operations to complete
  await Promise.all(refreshPromises);
  console.log('Completed refreshing telemetry reporters for all extensions');
};
