/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import { CliCommandExecutor } from './cliCommandExecutor';
// import { CommandOutput } from './commandOutput';
// import { SfCommandBuilder } from './sfCommandBuilder';
// import { SfdxCommandBuilder } from './sfdxCommandBuilder';
import { execSync } from 'child_process';
import * as semver from 'semver';

export enum CheckCliEnum {
  validCli = 1,
  outdatedSFDXVersion = 2,
  onlySFv1 = 3,
  cliNotInstalled = 4,
  bothSFDXAndSFInstalled = 5
}

export class CheckCliVersion {

  public getSfdxCliVersion(): Promise<string> {
    try {
      const result = execSync('sfdx --version');
      return Promise.resolve(result.toString());
    } catch {
      return Promise.resolve('No SFDX CLI');
    }
  }
  public async getSfCliVersion(): Promise<string> {
    try {
      const result = execSync('sf --version');
      return Promise.resolve(result.toString());
    } catch {
      return Promise.resolve('No SF CLI');
    }
  }

  // public async parseSfdxCliVersion(sfdxCliVersion: string): Promise<number[]> {
  //   // Both SFDX and SF v2 can match a valid SFDX version, so there are 2 patterns to search for
  //   const sfdxPattern = /sfdx-cli\/(\d+\.\d+\.\d+)/;
  //   const sfdxMatch = sfdxPattern.exec(sfdxCliVersion);
  //   const sfPattern = /@salesforce\/cli\/(\d+\.\d+\.\d+)/;
  //   const sfMatch = sfPattern.exec(sfdxCliVersion);
  //   if (sfdxMatch) {
  //     const sfdxVersion = sfdxMatch[1];
  //     const sfdxVersionNumber = sfdxVersion.split('.').map(Number);
  //     return sfdxVersionNumber;
  //   }
  //   else if (sfMatch) {
  //     const sfdxVersion = sfMatch[1];
  //     const sfdxVersionNumber = sfdxVersion.split('.').map(Number);
  //     return sfdxVersionNumber;
  //   }
  //   return [-1];
  // }

  // public async parseSfCliVersion(sfCliVersion: string): Promise<number[]> {
  //   const sfPattern = /@salesforce\/cli\/(\d+\.\d+\.\d+)/;
  //   const sfMatch = sfPattern.exec(sfCliVersion);
  //   if (sfMatch) {
  //     const sfVersion = sfMatch[1];
  //     const sfVersionNumber = sfVersion.split('.').map(Number);
  //     return sfVersionNumber;
  //   }
  //   return [-1];
  // }

  public parseCliVersion(sfCliVersion: string): string {
    const pattern = /sfdx-cli\/(\d+\.\d+\.\d+)|@salesforce\/cli\/(\d+\.\d+\.\d+)/;
    const match = pattern.exec(sfCliVersion);
    const y = match?.length;
    console.log('y = ' + y);
    for (let x = 0; x < y!; x++) {
      console.log('match[' + x + '] = ' + match![x]);
    }
    // SFDX v7 reports results in match[1], SF v2 reports results in match[2]
    return match ? (match[1] ? match[1] : match[2]) : '0.0.0';
  }

  public validateCliInstallationAndVersion(sfdxCliVersionString: string, sfCliVersionString: string): CheckCliEnum {

    console.log('sfdxCliVersionString = ' + sfdxCliVersionString);
    console.log('sfCliVersionString = ' + sfCliVersionString);

    // Case 1: Neither SFDX CLI nor SF CLI is installed
    if (semver.satisfies(sfdxCliVersionString, '0.0.0') && semver.satisfies(sfCliVersionString, '0.0.0')) {
      return CheckCliEnum.cliNotInstalled;
    }

    // Case 2: Only SF CLI (v1) is installed (SF v1 cannot be used because it does not map sf to sfdx)
    if (semver.satisfies(sfdxCliVersionString, '0.0.0') && semver.satisfies(sfCliVersionString, '1.x')) {
      return CheckCliEnum.onlySFv1;
    }

    // Case 3: Both SFDX CLI (v7) and SF CLI (v2) are installed at the same time
    if (semver.satisfies(sfCliVersionString, '2.x') && !semver.satisfies(sfdxCliVersionString, sfCliVersionString)) {
      return CheckCliEnum.bothSFDXAndSFInstalled;
    }

    // Case 4: Outdated SFDX CLI version is installed
    const minSFDXVersion = '7.193.2';
    if (semver.satisfies(sfdxCliVersionString, ('<' + minSFDXVersion)) && semver.satisfies(sfCliVersionString, '<2.0.0')) {
      return CheckCliEnum.outdatedSFDXVersion;
    }

    // Case 5: Valid SFDX v7 version or SF v2 is installed
    return CheckCliEnum.validCli;
  }
}
