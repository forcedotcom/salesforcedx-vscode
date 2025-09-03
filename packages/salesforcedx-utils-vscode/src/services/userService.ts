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
import { TELEMETRY_GLOBAL_USER_ID, UNAUTHENTICATED_USER } from '../constants';
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
 * Gets the webUserId telemetry ID using workspace context instead of CLI.
 * This is additional to the original telemetry ID and uses hashed orgId + userId.
 * Used to track web users who cannot have CLI installed.
 */
export const getWebTelemetryUserId = async (
  sharedTelemetryProvider?: SharedTelemetryProvider
): Promise<string> => {
  // First, try to get the shared telemetry user ID from the provided provider
  if (sharedTelemetryProvider) {
    const sharedUserId = await sharedTelemetryProvider.getSharedTelemetryUserId();
    if (sharedUserId) {
      return sharedUserId;
    }
  }

  // Calculate the webUserId field ID based on the orgId and userId
  const context = WorkspaceContextUtil.getInstance();
  const orgId = context.orgId;
  const userId = context.username;

  // If we have org authorization data available (orgId + userId), use hashed value for webUserId field
  if (orgId && userId) {
    return hashUserIdentifier(orgId, userId);
  }

  // No org authorization available yet, return unauthenticated user for webUserId field
  return UNAUTHENTICATED_USER;
};
