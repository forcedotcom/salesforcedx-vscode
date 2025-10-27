/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { PreconditionChecker } from '../types';
import { OrgAuthInfo } from '../util/authInfo';

/** Checks if a Dev Hub is configured */
export class DevUsernameChecker implements PreconditionChecker {
  public async check(): Promise<boolean> {
    const targetDevHubOrAlias = await OrgAuthInfo.getTargetDevHubOrAlias(true);
    if (!targetDevHubOrAlias) {
      return false;
    }

    return true;
  }
}
