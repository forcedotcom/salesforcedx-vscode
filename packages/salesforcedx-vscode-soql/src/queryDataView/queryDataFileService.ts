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
import { getRootWorkspacePath } from '../commonUtils';
import { QUERY_RESULTS_DIR_NAME, QUERY_RESULTS_DIR_PATH } from '../constants';
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

  constructor(
    private queryData: QueryResult<JsonMap>,
    private format: FileFormat,
    private documentName: string
  ) {
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
    let queryDataSelectedPath = '';
    const fileContent = this.dataProvider.getFileContent(
      this.queryData.records
    );
    const defaultFileName = this.dataProvider.getFileName();
    /* queryDataDefaultFilePath will be used as the default options in the save dialog:
        fileName: The name of the soqlFile viewed in the builder
        path: <workspaceDir>/<QUERY_RESULTS_DIR_PATH>
    however the default dir must exist for it to show up
    in the save dialog.
    */
    const queryDataDefaultFilePath = path.join(
      this.getResultsDirectoryPath(),
      defaultFileName
    );

    const saveDialogOptions = {
      defaultUri: vscode.Uri.file(queryDataDefaultFilePath)
    };
    /* We should probably change this to just save in scripts/soql,
    instead of make a new directory.
    this.createResultsDirectoryIfDoesNotExist();
    */
    this.createResultsDirectoryIfDoesNotExist();
    queryDataSelectedPath = await vscode.window
      .showSaveDialog({ ...saveDialogOptions })
      .then((fileInfo: vscode.Uri | undefined) => {
        if (fileInfo) {
          queryDataSelectedPath = fileInfo.path;
          // Save query results to disk
          fs.writeFileSync(fileInfo.path, fileContent);
          // Only reveal saved file if its inside current workspace
          if (fileInfo.path.startsWith(getRootWorkspacePath())) {
            this.showFileInExplorer(fileInfo.path);
          }
          this.showSaveSuccessMessage(path.basename(fileInfo.path));

          return fileInfo.path;
        }
        return '';
      });

    return queryDataSelectedPath;
  }

  private getResultsDirectoryPath() {
    return path.join(getRootWorkspacePath(), QUERY_RESULTS_DIR_PATH);
  }

  private createResultsDirectoryIfDoesNotExist() {
    fs.mkdirSync(this.getResultsDirectoryPath(), {
      recursive: true
    });
  }

  private showFileInExplorer(targetPath: string) {
    vscode.commands.executeCommand(
      'revealInExplorer',
      vscode.Uri.file(targetPath)
    );
  }

  private showSaveSuccessMessage(savedFileName: string) {
    vscode.window.showInformationMessage(
      nls.localize(
        'info_file_save_success',
        QUERY_RESULTS_DIR_NAME,
        savedFileName
      )
    );
  }
}
