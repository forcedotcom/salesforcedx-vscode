/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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

  public getSfdxCliVersion(): string {
    try {
      const result = execSync('sfdx --version');
      return result.toString();
    } catch {
      return 'No SFDX CLI';
    }
  }
  public getSfCliVersion(): string {
    try {
      const result = execSync('sf --version');
      return result.toString();
    } catch {
      return 'No SF CLI';
    }
  }

  public parseCliVersion(sfCliVersion: string): string {
    const pattern = (?:sfdx-cli\/|@salesforce\/cli\/)(\d+\.\d+\.\d+);
    const match = pattern.exec(sfCliVersion);
    // SFDX v7 reports results in match[1], SF v2 reports results in match[2]
    return match ? match[1] : '0.0.0';
  }

  public validateCliInstallationAndVersion(sfdxCliVersionString: string, sfCliVersionString: string): CheckCliEnum {

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
    if (semver.satisfies(sfdxCliVersionString, (`<${minSFDXVersion}`) && semver.satisfies(sfCliVersionString, '<2.0.0')) {
      return CheckCliEnum.outdatedSFDXVersion;
    }

    // Case 5: Valid SFDX v7 version or SF v2 is installed
    return CheckCliEnum.validCli;
  }
}
