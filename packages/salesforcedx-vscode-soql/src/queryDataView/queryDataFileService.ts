/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import { getRootWorkspacePath, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import type { JsonMap } from '@salesforce/ts-types';
import { homedir } from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDocumentName } from '../commonUtils';
import { nls } from '../messages';
import { CsvDataProvider, DataProvider, JsonDataProvider } from './dataProviders';

export enum FileFormat {
  JSON = 'json',
  CSV = 'csv'
}

export class QueryDataFileService {
  private dataProvider: DataProvider;
  private documentName: string;

  constructor(
    private queryText: string,
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
    const defaultFileName = this.dataProvider.getFileName();
    /*
        queryDataDefaultFilePath will be used as the default options in the save dialog
            fileName: The name of the soqlFile viewed in the builder
            path: the same directory as the .soql file text doc
                  or the home directory if .soql file does not exist yet
    */

    const saveDir = path.parse(this.document.uri.path).dir ?? homedir();
    const queryDataDefaultFilePath = path.join(saveDir, defaultFileName);

    const fileInfo: URI | undefined = await vscode.window.showSaveDialog({
      defaultUri: URI.file(queryDataDefaultFilePath)
    });

    if (fileInfo?.fsPath) {
      // use .fsPath, not .path to account for OS.
      const selectedFileSavePath = fileInfo.fsPath;
      const fileContentString = this.dataProvider.getFileContent(this.queryText, this.queryData.records);

      // Save query results to disk
      await writeFile(selectedFileSavePath, fileContentString);
      showFileInExplorer(selectedFileSavePath);
      showSaveSuccessMessage(path.basename(selectedFileSavePath));
      return selectedFileSavePath;
    }
    return '';
  }
}

const showFileInExplorer = (targetPath: string) => {
  // Only reveal saved file if its inside current workspace
  if (targetPath.startsWith(getRootWorkspacePath())) {
    vscode.commands.executeCommand('revealInExplorer', URI.file(targetPath));
  }
};

const showSaveSuccessMessage = (savedFileName: string) => {
  vscode.window.showInformationMessage(nls.localize('info_file_save_success', savedFileName));
};
