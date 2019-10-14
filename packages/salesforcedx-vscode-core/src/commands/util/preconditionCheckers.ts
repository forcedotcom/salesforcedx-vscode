/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/src/helpers';
import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { workspace } from 'vscode';
import { notificationService } from '../../notifications';
import { isSfdxProjectOpened } from '../../predicates';
import { OrgAuthInfo } from '../../util';

export class SfdxWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    const result = isSfdxProjectOpened.apply(workspace);
    if (!result.result) {
      notificationService.showErrorMessage(result.message);
      return false;
    }
    return true;
  }
}

export class EmptyPreChecker implements PreconditionChecker {
  public check(): boolean {
    return true;
  }
}

export class DevUsernameChecker implements PreconditionChecker {
  public async check(): Promise<boolean> {
    if (
      isNullOrUndefined(await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true))
    ) {
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }
}

export class CompositePreconditionChecker implements PreconditionChecker {
  public checks: PreconditionChecker[];
  public constructor(...checks: PreconditionChecker[]) {
    this.checks = checks;
  }
  public async check(): Promise<boolean> {
    for (const output of this.checks) {
      const input = await output.check();
      if (input === false) {
        return Promise.resolve(false);
      }
    }
    return Promise.resolve(true);
  }
}
