/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode';
import { workspace } from 'vscode';
import { notificationService } from '../../notifications';
import { isSfdxProjectOpened } from '../../predicates';

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
