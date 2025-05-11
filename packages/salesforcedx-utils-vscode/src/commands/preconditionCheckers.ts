/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { workspace } from 'vscode';
import { fileExists } from '../helpers/utils';
import { nls } from '../messages';
import { Predicate, PredicateResponse } from '../predicates';
import { PreconditionChecker, SFDX_PROJECT_FILE } from '../types';
import { getRootWorkspacePath, hasRootWorkspace } from '../workspaces';
import { notificationService } from './index';

class IsSalesforceProjectOpened implements Predicate<typeof workspace> {
  public async apply(item: typeof workspace): Promise<PredicateResponse> {
    if (!hasRootWorkspace()) {
      return PredicateResponse.of(false, nls.localize('predicates_no_folder_opened_text'));
    } else if (!(await fileExists(path.join(getRootWorkspacePath(), SFDX_PROJECT_FILE)))) {
      return PredicateResponse.of(false, nls.localize('predicates_no_salesforce_project_found_text'));
    } else {
      return PredicateResponse.true();
    }
  }
}

const isSalesforceProjectOpened = new IsSalesforceProjectOpened();

export class SfWorkspaceChecker implements PreconditionChecker {
  public async check(): Promise<boolean> {
    const result = await isSalesforceProjectOpened.apply(workspace);
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
