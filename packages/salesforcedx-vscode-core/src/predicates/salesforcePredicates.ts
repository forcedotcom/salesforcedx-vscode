/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Predicate, PredicateResponse, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SFDX_PROJECT_FILE } from '../constants';
import { nls } from '../messages';

export class IsSalesforceProjectOpened implements Predicate {
  public apply(): PredicateResponse {
    if (!workspaceUtils.hasRootWorkspace()) {
      return PredicateResponse.of(false, nls.localize('predicates_no_folder_opened_text'));
    } else if (!fs.existsSync(path.join(workspaceUtils.getRootWorkspacePath(), SFDX_PROJECT_FILE))) {
      return PredicateResponse.of(false, nls.localize('predicates_no_salesforce_project_found_text'));
    } else {
      return PredicateResponse.true();
    }
  }
}
