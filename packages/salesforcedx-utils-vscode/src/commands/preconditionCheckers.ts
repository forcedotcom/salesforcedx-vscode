/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { fileOrFolderExists } from '../helpers/fs';
import { nls } from '../messages';
import { PreconditionChecker, SFDX_PROJECT_FILE } from '../types';
import { workspaceUtils } from '../workspaces';
import { NotificationService } from './notificationService';

export const isSalesforceProjectOpened = async (): Promise<
  { result: true; message?: never } | { result: false; message: string }
> => {
  if (!workspaceUtils.hasRootWorkspace()) {
    return { result: false, message: nls.localize('predicates_no_folder_opened_text') };
  }
  if (!(await fileOrFolderExists(path.join(workspaceUtils.getRootWorkspacePath(), SFDX_PROJECT_FILE)))) {
    return { result: false, message: nls.localize('predicates_no_salesforce_project_found_text') };
  }
  return { result: true };
};

export class SfWorkspaceChecker implements PreconditionChecker {
  public async check(): Promise<boolean> {
    const result = await isSalesforceProjectOpened();
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
