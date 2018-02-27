/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export class ForceConfigGet {
  public async getConfig(projectPath: string, ...keys: string[]): Promise<any> {
    const commandBuilder = new SfdxCommandBuilder().withArg('force:config:get');
    keys.forEach(key => commandBuilder.withArg(key));

    const execution = new CliCommandExecutor(
      commandBuilder.withArg('--json').build(),
      {
        cwd: projectPath
      }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const forceConfig = JSON.parse(result).result as any;
      return Promise.resolve(forceConfig);
    } catch (e) {
      return Promise.reject(result);
    }
  }
}
