/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  flushFilePaths
} from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';

export class LibraryPathsGatherer implements ParametersGatherer<string[]> {
  private uris: vscode.Uri[];
  public constructor(uris: vscode.Uri[]) {
    this.uris = uris;
  }
  public async gather(): Promise<ContinueResponse<string[]>> {

    // jab
    // const sourcePaths0 = this.uris.map(uri => uri.fsPath);
    // const sourcePaths1 = flushFilePaths(sourcePaths0);
    // if(JSON.stringify(sourcePaths0) !== JSON.stringify(sourcePaths1)) {
    //   debugger;
    // }

    let sourcePaths = this.uris.map(uri => uri.fsPath);
    // sourcePaths = flushFilePaths(sourcePaths);

    return {
      type: 'CONTINUE',
      data: sourcePaths
    };
  }
}
