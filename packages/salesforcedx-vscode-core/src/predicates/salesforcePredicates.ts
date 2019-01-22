/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Predicate,
  PredicateResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/predicates/predicate';
import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';
import { SFDX_PROJECT_FILE } from '../constants';
import { nls } from '../messages';

export class IsSfdxProjectOpened implements Predicate<typeof workspace> {
  public apply(item: typeof workspace): PredicateResponse {
    if (!workspace.rootPath) {
      return PredicateResponse.of(
        false,
        nls.localize('predicates_no_folder_opened_text')
      );
    } else if (
      !fs.existsSync(path.join(workspace.rootPath, SFDX_PROJECT_FILE))
    ) {
      return PredicateResponse.of(
        false,
        nls.localize('predicates_no_sfdx_project_found_text')
      );
    } else {
      return PredicateResponse.true();
    }
  }
}

export class IsInSfdxPackageDirectory implements Predicate<string> {
  private packageDirectoryPaths: string[];
  constructor(packageDirectoryPaths: string[]) {
    this.packageDirectoryPaths = packageDirectoryPaths;
  }
  public apply(filePath: string): PredicateResponse {
    let filePathIsInPackageDirectory = false;
    for (const packageDirectoryPath of this.packageDirectoryPaths) {
      if (filePath.startsWith(packageDirectoryPath)) {
        filePathIsInPackageDirectory = true;
        break;
      }
    }
    return filePathIsInPackageDirectory
      ? PredicateResponse.true()
      : PredicateResponse.false();
  }
}
