/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import { Uri } from 'vscode';
import { sfdxCoreSettings } from '../../settings';

export class InternalDevWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    return sfdxCoreSettings.getInternalDev();
  }
}

export class LwcOssWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    return !fs.existsSync('**/lwc-services.config.js');
  }
}

export class FileInternalPathGatherer
  implements ParametersGatherer<{ outputdir: string }> {
  private filePath: string;
  public constructor(uri: Uri) {
    this.filePath = uri.fsPath;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ outputdir: string }>
  > {
    const outputdir = this.filePath;
    const isDir =
      fs.existsSync(outputdir) && fs.lstatSync(outputdir).isDirectory();

    if (isDir) {
      return { type: 'CONTINUE', data: { outputdir } };
    }

    return { type: 'CANCEL' };
  }
}
