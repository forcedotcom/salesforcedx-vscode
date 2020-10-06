/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import * as fs from 'fs';
import { QueryResult } from 'jsforce';
import * as Papa from 'papaparse';
import * as path from 'path';
import * as vscode from 'vscode';
import { DATA_CSV_EXT, DATA_JSON_EXT, QUERY_DATA_DIR_NAME } from '../constants';

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
    private format: FileFormat,
    private documentName: string
  ) {}

  public save() {
    // TODO: only create dir if there is data?
    switch (this.format) {
      case FileFormat.CSV:
        this.saveCsvToFs();
        break;
      case FileFormat.JSON:
        this.saveJsonToFs();
      default:
        break;
    }
  }

  private getRecordsDirectoryPath() {
    return path.join(
      getRootWorkspacePath(),
      'scripts',
      'soql',
      QUERY_DATA_DIR_NAME
    );
  }

  private createRecordsDirectoryIfDoesNotExist() {
    // will create the directory if it does not exist
    const recordsDirPath = fs.mkdirSync(this.getRecordsDirectoryPath(), {
      recursive: true
    });
    return recordsDirPath;
  }

  private showFileInExporer(targetPath: string) {
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

  private saveCsvToFs() {
    const savedFileName = `${this.documentName}.${DATA_CSV_EXT}`;
    try {
      const queryRecordsCsv = Papa.unparse(this.queryData.records, {
        header: true,
        delimiter: ','
      });
      const queryDataFilePath = path.join(
        this.getRecordsDirectoryPath(),
        savedFileName
      );

      this.createRecordsDirectoryIfDoesNotExist();
      fs.writeFileSync(queryDataFilePath, queryRecordsCsv);
      this.showSaveSuccessMessage(savedFileName);
      this.showFileInExporer(queryDataFilePath);
    } catch (error) {
      // TODO: i18n, CCX
      vscode.window.showErrorMessage(
        `Your data could not be saved. Run the query and try again.`
      );
      throw error;
    }
  }

  private saveJsonToFs() {
    // TODO: try catch, format the json string with prittier?
    const queryRecordsJson = JSON.stringify(this.queryData.records);
    const queryDataFilePath = path.join(
      this.getRecordsDirectoryPath(),
      `${this.documentName}.${DATA_JSON_EXT}`
    );
    fs.writeFileSync(queryDataFilePath, queryRecordsJson);
  }
}
