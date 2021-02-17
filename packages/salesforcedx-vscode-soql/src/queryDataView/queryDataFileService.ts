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
    private queryText: string,
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

  public save(): string {
    const fileContent = this.dataProvider.getFileContent(
      this.queryText,
      this.queryData.records
    );
    const savedFileName = this.dataProvider.getFileName();
    const queryDataFilePath = path.join(
      this.getResultsDirectoryPath(),
      savedFileName
    );

    this.createResultsDirectoryIfDoesNotExist();
    // Save query results to disk
    fs.writeFileSync(queryDataFilePath, fileContent);
    this.showSaveSuccessMessage(savedFileName);
    this.showFileInExplorer(queryDataFilePath);

    return queryDataFilePath;
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
