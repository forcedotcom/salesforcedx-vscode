/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { randomBytes, createHash } from 'node:crypto';
import { ExtensionContext, extensions } from 'vscode';
import { TELEMETRY_GLOBAL_USER_ID } from '../constants';
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';

// Type definition for the Core extension API
interface SalesforceVSCodeCoreApi {
  getSharedTelemetryUserId?: () => Promise<string>;
}

export class UserService {
  /**
   * Generates a random user ID string for telemetry purposes.
   * The returned value is prefixed with 'RANDOM_' and consists of 40 hexadecimal characters,
   * because 20 random bytes encoded as hex yields 40 characters (2 hex chars per byte).
   *
   * @returns {string} A randomly generated user ID string.
   */
  private static getRandomUserId = (): string =>
    // 20 bytes * 2 hex chars per byte = 40 hex characters
    `RANDOM_${randomBytes(20).toString('hex')}`
    ;

  /**
   * Attempts to get the shared telemetry user ID from the Core extension.
   * Returns undefined if the Core extension is not available or doesn't have the method.
   */
  private static async getSharedTelemetryUserId(): Promise<string | undefined> {
    try {
      const coreExtension = extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
      if (coreExtension && coreExtension.isActive && coreExtension.exports?.getSharedTelemetryUserId) {
        return await coreExtension.exports.getSharedTelemetryUserId();
      }
    } catch (error) {
      // Silently ignore errors - we'll fall back to extension-specific storage
      console.log(`Failed to get shared telemetry user ID: ${String(error)}`);
    }
    return undefined;
  }

  /**
   * Creates a one-way hash of orgId and userId for telemetry compliance.
   * This ensures customer data cannot be decoded while maintaining user distinction.
   */
  private static hashUserIdentifier(orgId: string, userId: string): string {
    return createHash('sha256').update(`${orgId}-${userId}`).digest('hex');
  }

  /**
   * Retrieves or generates a telemetry user ID for the current VS Code extension context.
   * The returned user ID is used for telemetry purposes and is determined as follows:
   *
   * 1. First, attempts to get a shared telemetry user ID from the Core extension if available.
   * 2. If shared ID is not available, falls back to extension-specific behavior:
   * a. If org authorization data (orgId and userId) is available:
   * - If no user ID exists in global state, or if the existing user ID is a random value, a deterministic SHA-256 hash of orgId and userId is generated, stored, and returned.
   * - If a non-random user ID already exists in global state, it is returned as-is.
   * b. If org authorization data is not available:
   * - If a user ID exists in global state, it is returned.
   * - Otherwise, a new random user ID is generated, stored, and returned.
   *
   * @param extensionContext - The VS Code extension context, used to access global state.
   * @returns The telemetry user ID, either shared, hashed, or randomly generated.
   */
  public static async getTelemetryUserId(extensionContext: ExtensionContext): Promise<string> {
    // First, try to get the shared telemetry user ID from the Core extension
    // Only check for shared user ID if this is not the Core extension itself (to avoid infinite loop)
    if (extensionContext.extension.id !== 'salesforce.salesforcedx-vscode-core') {
      const sharedUserId = await this.getSharedTelemetryUserId();
      if (sharedUserId) {
        return sharedUserId;
      }
    }

    // Calculate the telemetry ID based on the orgId and userId
    const globalStateUserId = extensionContext?.globalState.get<string | undefined>(TELEMETRY_GLOBAL_USER_ID);

    const context = WorkspaceContextUtil.getInstance();
    const orgId = context.orgId;
    const userId = context.username;

    // If we have org authorization data available (orgId + userId)
    if (orgId && userId) {
      // If globalStateUserId is undefined or is a random value, replace it with the hashed value
      if (!globalStateUserId || globalStateUserId.startsWith('RANDOM_')) {
        const hashedUserId = this.hashUserIdentifier(orgId, userId);
        await extensionContext?.globalState.update(TELEMETRY_GLOBAL_USER_ID, hashedUserId);
        return hashedUserId;
      }

      // If globalStateUserId already exists and is not random, keep it (don't change on new org auth)
      return globalStateUserId;
    }

    // No org authorization available yet
    if (globalStateUserId) {
      return globalStateUserId;
    }

    // If globalStateUserId is undefined and no org data available, create and store a random value
    const randomUserId = this.getRandomUserId();
    await extensionContext?.globalState.update(TELEMETRY_GLOBAL_USER_ID, randomUserId);
    return randomUserId;
  }
}
