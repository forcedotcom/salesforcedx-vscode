/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import * as fs from 'fs';
import { QueryResult } from 'jsforce';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDocumentName, getRootWorkspacePath } from '../commonUtils';
import { nls } from '../messages';
import {
  CsvDataProvider,
  DataProvider,
  JsonDataProvider
} from './dataProviders';

export enum FileFormat {
  JSON = 'json',
  CSV = 'csv'
}

export class QueryDataFileService {
  private dataProvider: DataProvider;
  private documentName: string;

  constructor(
    private queryData: QueryResult<JsonMap>,
    private format: FileFormat,
    private document: vscode.TextDocument
  ) {
    this.documentName = getDocumentName(document);
    this.dataProvider = this.getDataProvider();
  }

  protected getDataProvider(): DataProvider {
    switch (this.format) {
      case FileFormat.CSV:
        return new CsvDataProvider(this.documentName);
      case FileFormat.JSON:
        return new JsonDataProvider(this.documentName);
      default:
        throw new Error('No DataProvider Found');
    }
  }

  public async save(): Promise<string> {
    let selectedFileSavePath = '';
    const fileContent = this.dataProvider.getFileContent(
      this.queryData.records
    );
    const defaultFileName = this.dataProvider.getFileName();
    /* queryDataDefaultFilePath will be used as the default options in the save dialog
        fileName: The name of the soqlFile viewed in the builder
        path: the same directory as the .soql file text doc.
    note: directory must exist to show up in save dialog.
    */
    const queryDataDefaultFilePath = path.join(
      path.parse(this.document.uri.path).dir,
      defaultFileName
    );

    const fileInfo: vscode.Uri | undefined = await vscode.window.showSaveDialog(
      {
        defaultUri: vscode.Uri.file(queryDataDefaultFilePath)
      }
    );

    if (fileInfo) {
      // use .fsPath, not .path to account for OS.
      selectedFileSavePath = fileInfo.fsPath;
      // Save query results to disk
      fs.writeFileSync(selectedFileSavePath, fileContent);
      this.showFileInExplorer(selectedFileSavePath);
      this.showSaveSuccessMessage(path.basename(selectedFileSavePath));
    }
    return selectedFileSavePath;
  }

  private showFileInExplorer(targetPath: string) {
    // Only reveal saved file if its inside current workspace
    if (targetPath.startsWith(getRootWorkspacePath())) {
      vscode.commands.executeCommand(
        'revealInExplorer',
        vscode.Uri.file(targetPath)
      );
    }
  }

  private showSaveSuccessMessage(savedFileName: string) {
    vscode.window.showInformationMessage(
      nls.localize('info_file_save_success', savedFileName)
    );
  }
}
