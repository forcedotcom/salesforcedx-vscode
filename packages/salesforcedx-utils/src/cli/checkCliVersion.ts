/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommandBuilder } from './sfdxCommandBuilder';
import { CliCommandExecutor } from './cliCommandExecutor';
import { CommandOutput } from './commandOutput';

export class CheckCliVersion {

  // decide whether to make a new function here or reuse isCLIInstalled() from packages/salesforcedx-vscode-core/src/util/cliConfiguration.ts
  // public async isCliInstalled() {
  // }

  public async getCliVersion(): Promise<void> {

    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('--version')
        .withJson()
        .build(),
        {}
      ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    console.log('**** result = ' + result);

    // Get the version number of the CLI
    let version = '';
    for (let position = 0; position < result.length; position++) {
      console.log('result[' + position + '] = {' + result[position] + '}');
      if (result[position] === ' ') {
        console.log('HERE');
        break;
      }
      else if (Number.isInteger(+result[position]) || result[position] === '.') {
        version += result[position];
      }

    }
    console.log('**** version = ' + version);

    // Get the type of CLI (the old SFDX or the new SF)
    let isSfdx = false;
    if (result.includes('sfdx')) {
      isSfdx = true;
    }
    console.log('**** isSfdx = ' + isSfdx);

    // throw new Error('Your installed CLI version is no longer supported. Uninstall CLI and reinstall it at https://developer.salesforce.com/tools/sfdxcli');

  }

}