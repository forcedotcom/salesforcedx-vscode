/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';
import { nls } from '../messages';
import { Predicate, PredicateResponse } from '../predicates';
import { PreconditionChecker, SFDX_PROJECT_FILE } from '../types';
import { getRootWorkspacePath, hasRootWorkspace } from '../workspaces';
import { notificationService } from './index';

export class IsSalesforceProjectOpened implements Predicate<typeof workspace> {
  public apply(item: typeof workspace): PredicateResponse {
    if (!hasRootWorkspace()) {
      return PredicateResponse.of(false, nls.localize('predicates_no_folder_opened_text'));
    } else if (!fs.existsSync(path.join(getRootWorkspacePath(), SFDX_PROJECT_FILE))) {
      return PredicateResponse.of(false, nls.localize('predicates_no_salesforce_project_found_text'));
    } else {
      return PredicateResponse.true();
    }
  }
}

export const isSalesforceProjectOpened = new IsSalesforceProjectOpened();

export class SfWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    const result = isSalesforceProjectOpened.apply(workspace);
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
