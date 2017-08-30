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

export class SObjectDescribeGlobal {
  public async describeGlobal(
    projectPath: string,
    type: string
  ): Promise<string[]> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:schema:sobject:list')
        .withFlag('--sobjecttypecategory', type)
        .withArg('--json')
        .build(),
      { cwd: projectPath }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const sobjects = JSON.parse(result).result as string[];
      return Promise.resolve(sobjects);
    } catch (e) {
      return Promise.reject(result);
    }
  }
}
