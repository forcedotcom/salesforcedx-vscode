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

  public async validateCliVersion(): Promise<void> {

    // Execute the command "sfdx --version" in the Terminal
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('--version')
        .withJson()
        .build(),
        {}
      ).execute();

    // Save the result of the command
    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    console.log('**** result = ' + result);

    // Parse the result to check if the version is supported
    const sfdxPattern = /sfdx-cli\/(\d+\.\d+\.\d+)/;
    const sfPattern = /@salesforce\/cli\/(\d+\.\d+\.\d+)/;

    const sfdxMatch = sfdxPattern.exec(result);
    const sfMatch = sfPattern.exec(result);

    // Case 1: SFDX CLI is installed
    if (sfdxMatch) {
      const sfdxVersion = sfdxMatch[1];
      const sfdxVersionNumber = sfdxVersion.split('.').map(Number);
      let validSfdxVersion = false;
      // The last working version of SFDX is v7.193.2
      if (sfdxVersionNumber[0] >= 7 && sfdxVersionNumber[1] >= 193 && sfdxVersionNumber[2] >= 2) {
        validSfdxVersion = true;
      }
      if (validSfdxVersion === false) {
        throw new Error('Your installed CLI version is no longer supported. Please uninstall your CLI and reinstall the latest version using this link: [https://developer.salesforce.com/tools/salesforcecli](https://developer.salesforce.com/tools/salesforcecli)');
      }
    }

    // Case 2: SF CLI is installed
    else if (sfMatch) {
      const sfVersion = sfMatch[1];
      const sfVersionNumber = sfVersion.split('.').map(Number);
      let validSfVersion = false;
      // SF v1 does not map sf commands to sfdx commands and is not supported
      if (sfVersionNumber[0] >= 2 && sfVersionNumber[1] >= 0 && sfVersionNumber[2] >= 0) {
        validSfVersion = true;
      }
      if (validSfVersion === false) {
        throw new Error('Your installed CLI version is no longer supported. Please uninstall your CLI and reinstall the latest version using this link: [https://developer.salesforce.com/tools/salesforcecli](https://developer.salesforce.com/tools/salesforcecli)');
      }
    }

    // Case 3: Neither SFDX CLI nor SF CLI is installed
    else {
      throw new Error('Either Salesforce CLI is not installed or only SF v1 is present. Install the latest CLI version from [https://developer.salesforce.com/tools/salesforcecli](https://developer.salesforce.com/tools/salesforcecli)');
    }

    // // Get the version number of the CLI
    // let version = '';
    // for (let position = 0; position < result.length; position++) {
    //   console.log('result[' + position + '] = {' + result[position] + '}');
    //   if (result[position] === ' ') {
    //     console.log('HERE');
    //     break;
    //   }
    //   else if (Number.isInteger(+result[position]) || result[position] === '.') {
    //     version += result[position];
    //   }

    // }
    // console.log('**** version = ' + version);

    // // Get the type of CLI (the old SFDX or the new SF)
    // let isSfdx = null;
    // if (result.includes('sfdx')) {
    //   isSfdx = true;
    // }
    // else if (result.includes('@salesforce')) {
    //   isSfdx = false;
    // }
    // else {
    //   throw new Error ('No compatible CLI installed');
    // }
    // console.log('**** isSfdx = ' + isSfdx);

    // throw new Error('Your installed CLI version is no longer supported. Uninstall CLI and reinstall it at https://developer.salesforce.com/tools/sfdxcli');

  }

}