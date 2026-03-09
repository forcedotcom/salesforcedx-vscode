/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import type { JsonMap } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { getDocumentName } from '../commonUtils';
import { nls } from '../messages';
import { getSoqlRuntime } from '../services/extensionProvider';
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

  public async save(): Promise<URI | undefined> {
    const defaultFileName = this.dataProvider.getFileName();
    const docUri = this.document.uri;
    const defaultUri =
      docUri.scheme === 'file' ? Utils.joinPath(Utils.dirname(docUri), defaultFileName) : undefined;

    const fileInfo: URI | undefined = await vscode.window.showSaveDialog({ defaultUri });

    if (fileInfo) {
      const fileContentString = this.dataProvider.getFileContent(this.queryText, this.queryData.records);

      const workspacePath = await getSoqlRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* getServicesApi;
          yield* api.services.FsService.writeFile(fileInfo, fileContentString);
          const { fsPath } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
          return fsPath;
        })
      );
      showFileInExplorer(fileInfo, workspacePath);
      showSaveSuccessMessage(Utils.basename(fileInfo));
      return fileInfo;
    }
    return undefined;
  }
}

const showFileInExplorer = (fileUri: URI, workspacePath: string): void => {
  // Only reveal saved file if its inside current workspace
  if (fileUri.fsPath.startsWith(workspacePath)) {
    vscode.commands.executeCommand('revealInExplorer', fileUri);
  }
};

const showSaveSuccessMessage = (savedFileName: string) => {
  vscode.window.showInformationMessage(nls.localize('info_file_save_success', savedFileName));
};
