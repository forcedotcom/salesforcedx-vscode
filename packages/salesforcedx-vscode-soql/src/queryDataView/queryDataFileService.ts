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

/**
 * Matches a single character that must not appear in an export file name (user input before `.csv` / `.json`).
 * Character class maps to:
 * - `/` `\` — path separators (would embed directories or escape the intended folder)
 * - `<` `>` `:` `"` `|` `?` `*` — reserved in Windows file names (and problematic on other OSes)
 * - `\x00`–`\x1f` — ASCII C0 control codes (NUL through Unit Separator), not allowed in portable file names
 */
const invalidFileNameCharRegExp = /[/\\<>:"|?*\x00-\x1f]/;

const stripTrailingExtension = (base: string, ext: string): string => {
  const suffix = `.${ext}`;
  if (base.toLowerCase().endsWith(suffix.toLowerCase())) {
    return base.slice(0, -suffix.length);
  }
  return base;
};

const getExportFileStemFromDocument = (document: vscode.TextDocument, fileExtension: string): string => {
  let stem = stripTrailingExtension(getDocumentName(document).trim(), fileExtension);
  stem = stripTrailingExtension(stem, 'soql');
  if (stem.length > 0) {
    return stem;
  }
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return `soql-query-results-${timestamp}`;
};

const validateExportResultsFileNameInput = (value: string, fileExtension: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return nls.localize('soql_export_results_file_name_empty_error');
  }
  const base = stripTrailingExtension(trimmed, fileExtension);
  if (!base) {
    return nls.localize('soql_export_results_file_name_format_error');
  }
  if (base === '.' || base === '..') {
    return nls.localize('soql_export_results_file_name_format_error');
  }
  if (invalidFileNameCharRegExp.test(base)) {
    return nls.localize('soql_export_results_file_name_format_error');
  }
  return undefined;
};

const normalizeExportResultsFileBaseName = (value: string, fileExtension: string): string =>
  stripTrailingExtension(value.trim(), fileExtension);

const writeQueryResultsAndNotify = Effect.fn('queryDataFileService.writeQueryResultsAndNotify')(function* (params: {
  fileUri: URI;
  fileContentString: string;
}) {
  const { fileUri, fileContentString } = params;
  const api = yield* getServicesApi;
  yield* api.services.FsService.writeFile(fileUri, fileContentString);
  const { fsPath } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  showFileInExplorer(fileUri, fsPath);
  showSaveSuccessMessage(Utils.basename(fileUri));
  return fileUri;
});

const saveQueryResultsViaMemfsPrompts = Effect.fn('queryDataFileService.saveQueryResultsViaMemfsPrompts')(function* (params: {
  queryText: string;
  queryData: QueryResult<JsonMap>;
  dataProvider: DataProvider;
  document: vscode.TextDocument;
}) {
  const { queryText, queryData, dataProvider, document } = params;
  const api = yield* getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const defaultStem = getExportFileStemFromDocument(document, dataProvider.fileExtension);

  const rawName = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('soql_export_results_file_name_prompt'),
      value: defaultStem,
      validateInput: (v: string) => validateExportResultsFileNameInput(v, dataProvider.fileExtension)
    })
  ).pipe(
    Effect.map(n => n?.trim()),
    Effect.flatMap(raw => promptService.considerUndefinedAsCancellation(raw))
  );

  const fileNameBase = normalizeExportResultsFileBaseName(rawName, dataProvider.fileExtension);

  const outputDir = yield* promptService.promptForOutputDir({
    defaultUri: Utils.joinPath(workspaceInfo.uri, 'scripts', 'soql'),
    description: nls.localize('soql_output_dir_default_description'),
    pickerPlaceHolder: nls.localize('soql_output_dir_prompt')
  });

  const fileUri = Utils.joinPath(outputDir, `${fileNameBase}.${dataProvider.fileExtension}`);

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [fileUri] });

  const fileContentString = dataProvider.getFileContent(queryText, queryData.records);
  return yield* writeQueryResultsAndNotify({ fileUri, fileContentString });
});

export class QueryDataFileService {
  private dataProvider: DataProvider;
  private documentName: string;

  constructor(
    private queryText: string,
    private queryData: QueryResult<JsonMap>,
    private format: FileFormat,
    private document: vscode.TextDocument
  ) {
    this.documentName = stripTrailingExtension(getDocumentName(document), 'soql');
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
    if (docUri.scheme === 'file') {
      const defaultUri = Utils.joinPath(Utils.dirname(docUri), defaultFileName);
      const fileInfo: URI | undefined = await vscode.window.showSaveDialog({ defaultUri });
      if (!fileInfo) {
        return undefined;
      }
      return this.persistExportedResults(fileInfo);
    }

    const uriOrNull = await getSoqlRuntime().runPromise(
      saveQueryResultsViaMemfsPrompts({
        queryText: this.queryText,
        queryData: this.queryData,
        dataProvider: this.dataProvider,
        document: this.document
      }).pipe(Effect.catchTag('UserCancellationError', () => Effect.succeed(null)))
    );
    return uriOrNull ?? undefined;
  }

  private async persistExportedResults(fileUri: URI): Promise<URI> {
    const fileContentString = this.dataProvider.getFileContent(this.queryText, this.queryData.records);
    return getSoqlRuntime().runPromise(writeQueryResultsAndNotify({ fileUri, fileContentString }));
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
