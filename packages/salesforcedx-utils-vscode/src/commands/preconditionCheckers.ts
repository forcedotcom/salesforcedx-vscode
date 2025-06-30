/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { nls } from '../messages';
import { PreconditionChecker, SFDX_PROJECT_FILE } from '../types';
import { workspaceUtils } from '../workspaces';
import { NotificationService } from './notificationService';

export const isSalesforceProjectOpened = (): { result: true; message?: never } | { result: false; message: string } => {
  if (!workspaceUtils.hasRootWorkspace()) {
    return { result: false, message: nls.localize('predicates_no_folder_opened_text') };
  }
  if (!fs.existsSync(path.join(workspaceUtils.getRootWorkspacePath(), SFDX_PROJECT_FILE))) {
    return { result: false, message: nls.localize('predicates_no_salesforce_project_found_text') };
  }
  return { result: true };
};

export class SfWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    const result = isSalesforceProjectOpened();
    if (!result.result) {
      NotificationService.getInstance().showErrorMessage(result.message);
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
