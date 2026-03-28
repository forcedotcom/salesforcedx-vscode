/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import type { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';
import { getFlattenedSoqlGridPayload } from '../commands/dataQuery';

export const SOQL_RESULTS_SCHEME = 'soql-results';

type StoredResult = {
  queryData: QueryResult<JsonMap>;
  document: vscode.TextDocument;
};

export class QueryResultsMarkdownProvider implements vscode.TextDocumentContentProvider {
  private readonly store = new Map<string, StoredResult & { markdown: string }>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.emitter.event;

  public update(uri: vscode.Uri, queryData: QueryResult<JsonMap>, documentName: string, document: vscode.TextDocument): void {
    const markdown = generateMarkdown(documentName, queryData);
    this.store.set(uri.toString(), { markdown, queryData, document });
    this.emitter.fire(uri);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.store.get(uri.toString())?.markdown ?? '';
  }

  public getStoredResult(uri: vscode.Uri): StoredResult | undefined {
    const entry = this.store.get(uri.toString());
    if (!entry) {
      return undefined;
    }
    return { queryData: entry.queryData, document: entry.document };
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}

export const generateMarkdown = (documentName: string, queryData: QueryResult<JsonMap>): string => {
  const { totalSize, records } = queryData;
  const returnedCount = records.length;

  const header = [`# ${documentName}`, '', `Returned ${returnedCount} of ${totalSize} total records`, ''];

  if (records.length === 0) {
    return [...header, '_No records found._'].join('\n');
  }

  const grid = getFlattenedSoqlGridPayload(records);
  if (!grid || grid.fields.length === 0) {
    return [...header, '_No records found._'].join('\n');
  }

  const { fields, rowData } = grid;

  const tableHeader = `| ${fields.join(' | ')} |`;
  const tableSeparator = `| ${fields.map(() => '---').join(' | ')} |`;
  const tableRows = rowData.map(row => {
    const cells = fields.map(f => (row[f] ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ''));
    return `| ${cells.join(' | ')} |`;
  });

  return [...header, tableHeader, tableSeparator, ...tableRows].join('\n');
};
