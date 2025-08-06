/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import { CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { randomBytes, createHash } from 'node:crypto';
import { ExtensionContext } from 'vscode';
// import { CliCommandExecutor, workspaceUtils } from '..';
import { TELEMETRY_GLOBAL_USER_ID } from '../constants';
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';

export class UserService {
  private static getRandomUserId = (): string => randomBytes(20).toString('hex');

  /**
   * Creates a one-way hash of orgId and userId for telemetry compliance.
   * This ensures customer data cannot be decoded while maintaining user distinction.
   */
  private static hashUserIdentifier(orgId: string, userId: string): string {
    return createHash('sha256').update(`${orgId}-${userId}`).digest('hex');
  }

  public static async getTelemetryUserId(extensionContext: ExtensionContext): Promise<string> {
    // Defining UserId in globalState and using the same in appInsights reporter.
    // Assigns cliId to UserId when it's undefined in global state.
    // cliId is undefined when cli-telemetry variable disable-telemetry is true.
    const globalStateUserId = extensionContext?.globalState.get<string | undefined>(TELEMETRY_GLOBAL_USER_ID);

    if (globalStateUserId) {
      return globalStateUserId;
    }

    // If globalStateUserId is undefined, we should use a hashed combination of (orgId + userId) as the user id
    // This complies with Salesforce policy by ensuring customer data cannot be decoded from telemetry
    const context = WorkspaceContextUtil.getInstance();
    const orgId = context.orgId;
    const userId = context.username;
    if (orgId && userId) {
      return this.hashUserIdentifier(orgId, userId);
    }

    // If the random UserId value is used here it will be unique per extension.
    await extensionContext?.globalState.update(TELEMETRY_GLOBAL_USER_ID, globalStateUserId);

    return globalStateUserId ?? this.getRandomUserId();
  }
}
