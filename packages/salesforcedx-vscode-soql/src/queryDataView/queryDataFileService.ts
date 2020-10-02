/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as vscode from 'vscode';
import * as fs from 'fs';

export enum FileFormat {
  JSON = 'json',
  CSV = 'csv'
}

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension
  ? sfdxCoreExtension.exports
  : undefined;
const { getRootWorkspacePath } = sfdxCoreExports;

export class QueryDataFileService {
  constructor(
    private queryData: QueryResult<JsonMap>,
    private format: FileFormat
  ) {}

  public save() {
    switch (this.format) {
      case FileFormat.CSV:
        console.log('GET MY CSV!!!', this.queryData);
        break;
      case FileFormat.JSON:
        console.log('SAVE MY JSON FILE!');
      default:
        break;
    }
  }
}

/* 
  // NOTE: can use the VS Code Core Utils to do this get the workspace path.
  private saveQueryDataToFile(queryRecords: JsonMap[]) {
    const queryRecordsJson = JSON.stringify(queryRecords);
    const workspace = vscode.workspace;
    // Assumes a single sfdx-proj is root directory
    const workspacePath = workspace.workspaceFolders![0];

    // --- SAVE RESULTS IN A DATA DIRECTORY --- //
    const documentName = this.getDocumentName(this.document);
    const queryDataDirectoryUri = vscode.Uri.joinPath(
      workspacePath.uri,
      QUERY_DATA_DIR_NAME
    );
    const queryDataFilePathInDirectory = path.join(
      queryDataDirectoryUri.fsPath,
      `${documentName}.${QUERY_DATA_EXT}`
    );
    // will create the directory if it does not exist
    fs.mkdirSync(queryDataDirectoryUri.fsPath, {
      recursive: true
    });
    fs.writeFileSync(queryDataFilePathInDirectory, queryRecordsJson);
    return queryDataPathWithDocument;
  } */
