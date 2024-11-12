/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isNullOrUndefined, PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode';
import { OrgAuthInfo } from '../../util';

export class DevUsernameChecker implements PreconditionChecker {
  public async check(): Promise<boolean> {
    const targetDevHubOrAlias = await OrgAuthInfo.getTargetDevHubOrAlias(true);
    if (isNullOrUndefined(targetDevHubOrAlias)) {
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }
}
