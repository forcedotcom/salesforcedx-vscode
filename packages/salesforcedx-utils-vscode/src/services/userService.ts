/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { randomBytes, createHash } from 'node:crypto';
import { ExtensionContext } from 'vscode';
import { TELEMETRY_GLOBAL_USER_ID } from '../constants';
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';

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
   * Creates a one-way hash of orgId and userId for telemetry compliance.
   * This ensures customer data cannot be decoded while maintaining user distinction.
   */
  private static hashUserIdentifier(orgId: string, userId: string): string {
    return createHash('sha256').update(`${orgId}-${userId}`).digest('hex');
  }

  /**
   * Retrieves or generates a telemetry user ID for the current VS Code extension context.
   *
   * The returned user ID is used for telemetry purposes and is determined as follows:
   *
   * 1. If org authorization data (orgId and userId) is available:
   * a. If no user ID exists in global state, or if the existing user ID is a random value, a deterministic SHA-256 hash of orgId and userId is generated, stored, and returned.
   * b. If a non-random user ID already exists in global state, it is returned as-is (don't change on new org auth)
   *
   * 2. If org authorization data is not available:
   * a. If a user ID exists in global state, it is returned.
   * b. Otherwise, a new random user ID is generated, stored, and returned.
   *
   * @param {ExtensionContext} extensionContext - The VS Code extension context, used to access global state.
   * @returns {Promise<string>} The telemetry user ID, either hashed or randomly generated.
   */
  public static async getTelemetryUserId(extensionContext: ExtensionContext): Promise<string> {
    // Defining UserId in globalState and using the same in appInsights reporter.
    // Assigns cliId to UserId when it's undefined in global state.
    // cliId is undefined when cli-telemetry variable disable-telemetry is true.
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
