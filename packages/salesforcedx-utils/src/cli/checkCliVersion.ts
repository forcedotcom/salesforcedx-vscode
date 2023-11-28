/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

import { CliCommandExecutor } from './cliCommandExecutor';
import { CommandOutput } from './commandOutput';
import { SfCommandBuilder } from './sfCommandBuilder';
import { SfdxCommandBuilder } from './sfdxCommandBuilder';

export enum CheckCliEnum {
  validCli = 1,
  outdatedSFDXVersion = 2,
  onlySFv1 = 3,
  cliNotInstalled = 4,
  bothSFDXAndSFInstalled = 5
}

export class CheckCliVersion {

  public async getSfdxCliVersion(): Promise<string> {
    try {
      // Execute the command "sfdx --version" in the Terminal
      const sfdxExecution = new CliCommandExecutor(
        new SfdxCommandBuilder().withArg('--version').withJson().build(),
        {}
      ).execute();
      // Save the result of the command
      const sfdxCmdOutput = new CommandOutput();
      const sfdxVersion = await sfdxCmdOutput.getCmdResult(sfdxExecution);
      return sfdxVersion;
    } catch {
      return 'No SFDX CLI';
    }
  }

  public async getSfCliVersion(): Promise<string> {
    try {
      // Execute the command "sf --version" in the Terminal
      const sfExecution = new CliCommandExecutor(
        new SfCommandBuilder().withArg('--version').withJson().build(),
        {}
      ).execute();
      // Save the result of the command
      const sfCmdOutput = new CommandOutput();
      const sfVersion = await sfCmdOutput.getCmdResult(sfExecution);
      return sfVersion;
    } catch {
      return 'No SF CLI';
    }
  }

  public async parseSfdxCliVersion(sfdxCliVersion: string): Promise<number[]> {
    // Both SFDX and SF v2 can match a valid SFDX version, so there are 2 patterns to search for
    const sfdxPattern = /sfdx-cli\/(\d+\.\d+\.\d+)/;
    const sfdxMatch = sfdxPattern.exec(sfdxCliVersion);
    const sfPattern = /@salesforce\/cli\/(\d+\.\d+\.\d+)/;
    const sfMatch = sfPattern.exec(sfdxCliVersion);
    if (sfdxMatch) {
      const sfdxVersion = sfdxMatch[1];
      const sfdxVersionNumber = sfdxVersion.split('.').map(Number);
      return sfdxVersionNumber;
    }
    else if (sfMatch) {
      const sfdxVersion = sfMatch[1];
      const sfdxVersionNumber = sfdxVersion.split('.').map(Number);
      return sfdxVersionNumber;
    }
    return [-1];
  }

  public async parseSfCliVersion(sfCliVersion: string): Promise<number[]> {
    const sfPattern = /@salesforce\/cli\/(\d+\.\d+\.\d+)/;
    const sfMatch = sfPattern.exec(sfCliVersion);
    if (sfMatch) {
      const sfVersion = sfMatch[1];
      const sfVersionNumber = sfVersion.split('.').map(Number);
      return sfVersionNumber;
    }
    return [-1];
  }

  public async validateCliInstallationAndVersion(sfdxCliVersionArray: number[], sfCliVersionArray: number[]): Promise<Number> {
    // The last working version of SFDX is v7.193.2
    const minSFDXVersion = '7.193.2';
    const minSFDXVersionArray = minSFDXVersion.split('.').map(Number);

    // SF v1 does not map sf commands to sfdx commands and is not supported
    const minSFVersion = '2.0.0';
    const minSFVersionArray = minSFVersion.split('.').map(Number);

    // Case 1: Neither SFDX CLI nor SF CLI is installed
    if (sfdxCliVersionArray[0] === -1 && sfCliVersionArray[0] === -1) {
      return CheckCliEnum.cliNotInstalled;
    }

    // Case 2: Only SF CLI (v1) is installed (SF v1 cannot be used because it does not map sf to sfdx)
    if (sfdxCliVersionArray[0] === -1 && sfCliVersionArray[0] === 1) {
      return CheckCliEnum.onlySFv1;
    }

    // Case 3: Both SFDX CLI (v7) and SF CLI (v2) are installed at the same time
    if (sfCliVersionArray[0] >= minSFVersionArray[0] && !sfdxCliVersionArray.every((val, index) => val === sfCliVersionArray[index])) {
      return CheckCliEnum.bothSFDXAndSFInstalled;
    }

    // Case 4: SFDX CLI is installed - need to validate if the version is above the minimum supported version
    if (sfCliVersionArray[0] < minSFVersionArray[0] && sfdxCliVersionArray[0] !== -1) {
      if (
        sfdxCliVersionArray[0] >= minSFDXVersionArray[0] &&
        sfdxCliVersionArray[1] >= minSFDXVersionArray[1] &&
        sfdxCliVersionArray[2] >= minSFDXVersionArray[2]
      ) {
        return CheckCliEnum.validCli;
      } else {
        return CheckCliEnum.outdatedSFDXVersion;
      }
    }

    // Case 5: SF v2 is installed
    return CheckCliEnum.validCli;
  }
}
