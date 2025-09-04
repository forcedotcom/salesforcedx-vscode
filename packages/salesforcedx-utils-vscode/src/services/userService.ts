/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { randomBytes } from 'node:crypto';
import { ExtensionContext } from 'vscode';
import { CliCommandExecutor, workspaceUtils } from '..';
import { TELEMETRY_GLOBAL_USER_ID, TELEMETRY_GLOBAL_WEB_USER_ID, UNAUTHENTICATED_USER } from '../constants';
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';
import { getSharedTelemetryUserId, hashUserIdentifier } from '../helpers/telemetryUtils';

export class UserService {
  private static getRandomUserId = (): string => randomBytes(20).toString('hex');

  private static async executeCliTelemetry(): Promise<string> {
    const command = new SfCommandBuilder().withArg('telemetry').withJson().build();
    const workspacePath = workspaceUtils.getRootWorkspacePath();
    const execution = new CliCommandExecutor(command, { cwd: workspacePath }).execute();
    const cmdOutput = new CommandOutput();
    const result = cmdOutput.getCmdResult(execution);
    return result;
  }

  /** Gets the original telemetry user ID using CLI-based approach */
  public static async getTelemetryUserId(extensionContext: ExtensionContext): Promise<string> {
    // Defining UserId in globalState and using the same in appInsights reporter.
    // Assigns cliId to UserId when it's undefined in global state.
    // cliId is undefined when cli-telemetry variable disable-telemetry is true.
    let globalStateUserId = extensionContext?.globalState.get<string | undefined>(TELEMETRY_GLOBAL_USER_ID);

    if (globalStateUserId) {
      return globalStateUserId;
    }

    globalStateUserId = await this.executeCliTelemetry()
      .then((getCliTelemetryData): string => {
        // will be removed as part of removing CLI calls
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const cmdResult = JSON.parse(getCliTelemetryData) as {
          result?: { cliId: string };
        };
        return cmdResult?.result?.cliId ?? this.getRandomUserId();
      })
      .catch(error => {
        console.log(`Error: ${error} occurred in retrieving cliId, generating user-id ..`);
        return this.getRandomUserId();
      });
    // If the random UserId value is used here it will be unique per extension.
    await extensionContext?.globalState.update(TELEMETRY_GLOBAL_USER_ID, globalStateUserId);

    return globalStateUserId;
  }
}

/** Interface for providing shared telemetry user ID from Core extension */
export interface SharedTelemetryProvider {
  getSharedTelemetryUserId(): Promise<string | undefined>;
}

/** Default implementation that uses the existing getSharedTelemetryUserId function */
export class DefaultSharedTelemetryProvider implements SharedTelemetryProvider {
  public async getSharedTelemetryUserId(): Promise<string | undefined> {
    return await getSharedTelemetryUserId();
  }
}

/**
 * Retrieves or generates a telemetry user ID for the current VS Code extension context.
 * The returned user ID is used for telemetry purposes and is determined as follows:
 *
 * 1. First, attempts to get a shared telemetry user ID from the provided SharedTelemetryProvider if available.
 * 2. If shared ID is not available, falls back to extension-specific behavior:
 * a. If org authorization data (orgId and userId) is available:
 * - If no user ID exists in global state, or if the existing user ID is the anonymous user ID, a deterministic SHA-256 hash of orgId and userId is generated, stored, and returned.
 * - If a non-anonymous user ID already exists in global state, it is returned as-is.
 * b. If org authorization data is not available:
 * - If a user ID exists in global state, it is returned.
 * - Otherwise, the anonymous user ID is returned.
 *
 * @param extensionContext - The VS Code extension context, used to access global state.
 * @param sharedTelemetryProvider - Optional provider for shared telemetry user ID from Core extension.
 * @returns The telemetry user ID, either shared, hashed, or the anonymous user ID.
 */
export const getWebTelemetryUserId = async (
  extensionContext: ExtensionContext,
  sharedTelemetryProvider?: SharedTelemetryProvider
): Promise<string> => {
  // First, try to get the shared telemetry user ID from the provided provider
  if (sharedTelemetryProvider) {
    const sharedUserId = await sharedTelemetryProvider.getSharedTelemetryUserId();
    if (sharedUserId) {
      return sharedUserId;
    }
  }

  // Calculate the telemetry ID based on the orgId and userId
  extensionContext?.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, undefined);
  const globalStateUserId = extensionContext?.globalState.get<string | undefined>(TELEMETRY_GLOBAL_WEB_USER_ID);

  const context = WorkspaceContextUtil.getInstance();
  const orgId = context.orgId;
  const userId = context.username;

  // If we have org authorization data available (orgId + userId)
  if (orgId && userId) {
    // If globalStateUserId is undefined or is the anonymous user ID, replace it with the hashed value
    if (!globalStateUserId || globalStateUserId === UNAUTHENTICATED_USER) {
      const hashedUserId = hashUserIdentifier(orgId, userId);
      await extensionContext?.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, hashedUserId);
      return hashedUserId;
    }

    // If globalStateUserId already exists and is not the anonymous user ID, keep it (don't change on new org auth)
    return globalStateUserId;
  }

  // No org authorization available yet
  if (globalStateUserId) {
    return globalStateUserId;
  }

  // If globalStateUserId is undefined and no org data available, use the anonymous user ID
  await extensionContext?.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, UNAUTHENTICATED_USER);
  return UNAUTHENTICATED_USER;
};
