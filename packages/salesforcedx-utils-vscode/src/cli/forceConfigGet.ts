/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommandBuilder } from './commandBuilder';
import { CliCommandExecutor } from './commandExecutor';
import { CommandOutput } from './commandOutput';

export class ForceConfigGet {
  public async getConfig(
    projectPath: string,
    ...keys: string[]
  ): Promise<Map<string, string>> {
    const commandBuilder = new SfdxCommandBuilder().withArg('force:config:get');
    keys.forEach(key => commandBuilder.withArg(key));

    const execution = new CliCommandExecutor(
      commandBuilder.withJson().build(),
      {
        cwd: projectPath
      }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const forceConfigMap = new Map<string, string>();
      const results = JSON.parse(result).result as any[];
      results.forEach(entry => forceConfigMap.set(entry.key, entry.value));
      return Promise.resolve(forceConfigMap);
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
