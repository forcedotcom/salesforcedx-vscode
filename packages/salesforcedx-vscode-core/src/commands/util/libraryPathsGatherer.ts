/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileUtils } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export class LibraryPathsGatherer implements ParametersGatherer<string[]> {
  private uris: vscode.Uri[];

  public constructor(uris: vscode.Uri[]) {
    this.uris = uris;
  }

  public async gather(): Promise<ContinueResponse<string[]>> {
    const sourcePaths = this.uris.map(uri => uri.fsPath);
    const flushedSourcePaths = fileUtils.flushFilePaths(sourcePaths);

    return {
      type: 'CONTINUE',
      data: flushedSourcePaths
    };
  }
}
