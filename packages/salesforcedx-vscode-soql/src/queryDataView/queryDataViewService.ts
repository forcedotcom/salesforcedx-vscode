/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import type { JsonMap } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getDocumentName } from '../commonUtils';
import { nls } from '../messages';
import { getSoqlRuntime } from '../services/extensionProvider';
import { FileFormat, QueryDataFileService as FileService } from './queryDataFileService';
import { QueryResultsMarkdownProvider, SOQL_RESULTS_SCHEME } from './queryResultsMarkdownProvider';

const saveActiveDocument = (format: FileFormat): void => {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme !== SOQL_RESULTS_SCHEME) {
    return;
  }
  const stored = QueryDataViewService.provider.getStoredResult(activeUri);
  if (!stored) {
    return;
  }
  const { queryData, document } = stored;
  getSoqlRuntime().runFork(
    Effect.promise(() => {
      const fileService = new FileService(document.getText(), queryData, format, document);
      return fileService.save();
    }).pipe(
      Effect.asVoid,
      Effect.catchAllCause(() =>
        Effect.sync(() => {
          vscode.window.showErrorMessage(nls.localize('error_data_view_save'));
        })
      )
    )
  );
};

export class QueryDataViewService {
  public static provider: QueryResultsMarkdownProvider;

  constructor(
    _subscriptions: vscode.Disposable[],
    private readonly queryData: QueryResult<JsonMap>,
    private readonly document: vscode.TextDocument
  ) { }

  public static register(extensionContext: vscode.ExtensionContext): void {
    QueryDataViewService.provider = new QueryResultsMarkdownProvider();
    extensionContext.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(SOQL_RESULTS_SCHEME, QueryDataViewService.provider),
      vscode.commands.registerCommand('soql.results.saveAsCsv', () => saveActiveDocument(FileFormat.CSV)),
      vscode.commands.registerCommand('soql.results.saveAsJson', () => saveActiveDocument(FileFormat.JSON)),
      QueryDataViewService.provider
    );
  }

  public async createOrShowWebView(): Promise<void> {
    const documentName = getDocumentName(this.document);
    const tabName = documentName.replace(/\.soql$/i, '.md');
    const uri = vscode.Uri.parse(`${SOQL_RESULTS_SCHEME}:${encodeURIComponent(tabName)}`);

    QueryDataViewService.provider.update(uri, this.queryData, documentName, this.document);

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(doc, 'markdown');
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Two, preserveFocus: false });
  }
}
