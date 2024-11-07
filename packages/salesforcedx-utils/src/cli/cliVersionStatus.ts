/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import * as semver from 'semver';

export enum CliStatusEnum {
  SFv2 = 1,
  outdatedSFDXVersion = 2,
  onlySFv1 = 3,
  cliNotInstalled = 4,
  bothSFDXAndSFInstalled = 5,
  SFDXv7Valid = 6
}

export class CliVersionStatus {
  public getCliVersion(isSfdx: boolean): string {
    try {
      const result = execSync(`${isSfdx ? 'sfdx' : 'sf'} --version`);
      return result.toString();
    } catch {
      return 'No CLI';
    }
  }

  public parseCliVersion(cliVersion: string): string {
    const pattern = /(?:sfdx-cli\/|@salesforce\/cli\/)(\d+\.\d+\.\d+)/;
    const match = pattern.exec(cliVersion);
    return match ? match[1] : '0.0.0';
  }

  public validateCliInstallationAndVersion(sfdxCliVersionString: string, sfCliVersionString: string): CliStatusEnum {
    // Case 1: Neither SFDX CLI nor SF CLI is installed
    if (semver.satisfies(sfdxCliVersionString, '0.0.0') && semver.satisfies(sfCliVersionString, '0.0.0')) {
      return CliStatusEnum.cliNotInstalled;
    }

    // Case 2: Only SF CLI (v1) is installed (SF v1 cannot be used because it does not map sf to sfdx)
    if (semver.satisfies(sfdxCliVersionString, '0.0.0') && semver.satisfies(sfCliVersionString, '1.x')) {
      return CliStatusEnum.onlySFv1;
    }

    // Case 3: Both SFDX CLI (v7) and SF CLI (v2) are installed at the same time
    if (semver.satisfies(sfCliVersionString, '2.x') && !semver.satisfies(sfdxCliVersionString, sfCliVersionString)) {
      return CliStatusEnum.bothSFDXAndSFInstalled;
    }

    const minSFDXVersion = '7.193.2';
    if (semver.satisfies(sfCliVersionString, '<2.0.0')) {
      if (semver.satisfies(sfdxCliVersionString, `<${minSFDXVersion}`)) {
        // Case 4: Outdated SFDX CLI version is installed
        return CliStatusEnum.outdatedSFDXVersion;
      } else {
        // Case 5: Valid SFDX v7 version is installed
        return CliStatusEnum.SFDXv7Valid;
      }
    }

    // Case 6: SF v2 is installed
    return CliStatusEnum.SFv2;
  }
}
