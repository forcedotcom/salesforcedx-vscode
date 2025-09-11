/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { ExtensionContext } from 'vscode';
import { CliCommandExecutor, workspaceUtils } from '..';
import { TELEMETRY_GLOBAL_USER_ID } from '../constants';

export class UserService {
  private static getRandomUserId = (): string => {
    const array = new Uint8Array(20);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  private static async executeCliTelemetry(): Promise<string> {
    const command = new SfCommandBuilder().withArg('telemetry').withJson().build();
    const workspacePath = workspaceUtils.getRootWorkspacePath();
    const execution = new CliCommandExecutor(command, { cwd: workspacePath }).execute();
    const cmdOutput = new CommandOutput();
    const result = cmdOutput.getCmdResult(execution);
    return result;
  }

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
