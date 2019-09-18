/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Predicate,
  PredicateResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/predicates';
import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';
import { LWC_OSS_CONFIG_FILE, SFDX_PROJECT_FILE } from '../constants';
import { nls } from '../messages';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';

export class IsSfdxProjectOpened implements Predicate<typeof workspace> {
  public apply(item: typeof workspace): PredicateResponse {
    if (!hasRootWorkspace()) {
      return PredicateResponse.of(
        false,
        nls.localize('predicates_no_folder_opened_text')
      );
    } else if (
      !fs.existsSync(path.join(getRootWorkspacePath(), SFDX_PROJECT_FILE))
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

export class IsLwcOssProjectOpened implements Predicate<typeof workspace> {
  public apply(item: typeof workspace): PredicateResponse {
    if (!hasRootWorkspace()) {
      return PredicateResponse.of(
        false,
        nls.localize('predicates_no_folder_opened_text')
      );
    } else if (
      !fs.existsSync(path.join(getRootWorkspacePath(), LWC_OSS_CONFIG_FILE))
    ) {
      return PredicateResponse.of(
        false,
        nls.localize('predicates_no_lwc_oss_project_found_text')
      );
    } else {
      return PredicateResponse.true();
    }
  }
}
