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
import { QUERY_RESULTS_DIR_NAME } from '../constants';
import {
  CsvDataProvider,
  DataProvider,
  JsonDataProvider
} from './dataProviders';

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
  private dataProvider: DataProvider;

  constructor(
    private queryData: QueryResult<JsonMap>,
    private format: FileFormat,
    private documentName: string
  ) {
    this.dataProvider = this.getDataProvider();
  }

  private getDataProvider(): DataProvider {
    switch (this.format) {
      case FileFormat.CSV:
        return new CsvDataProvider(this.documentName);
      case FileFormat.JSON:
        return new JsonDataProvider(this.documentName);
      default:
        throw new Error('No DataProvider Found');
    }
  }

  public save(): void {
    try {
      const fileContent = this.dataProvider.getFileContent(
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
    } catch (error) {
      // TODO: i18n, CCX
      vscode.window.showErrorMessage(
        `Your data could not be saved. Run the query and try again.`
      );
      throw error;
    }
  }

  private getResultsDirectoryPath() {
    return path.join(
      getRootWorkspacePath(),
      'scripts',
      'soql',
      QUERY_RESULTS_DIR_NAME
    );
  }

  private createResultsDirectoryIfDoesNotExist() {
    fs.mkdirSync(this.getResultsDirectoryPath(), {
      recursive: true
    });
  }

  private showFileInExplorer(targetPath: string) {
    vscode.commands.executeCommand(
      'revealInExplorer',
      vscode.Uri.parse(targetPath)
    );
  }

  private showSaveSuccessMessage(savedFileName: string) {
    vscode.window.showInformationMessage(
      // TODO: i18n and CCX
      `Your data has been saved in this workspace as: ${savedFileName}`
    );
  }
}
