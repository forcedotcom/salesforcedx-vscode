/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { QueryResult } from '../../../src/types';
import type { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { generateMarkdown, QueryResultsMarkdownProvider, SOQL_RESULTS_SCHEME } from '../../../src/queryDataView/queryResultsMarkdownProvider';

describe('SOQL_RESULTS_SCHEME', () => {
  it('is soql-results', () => {
    expect(SOQL_RESULTS_SCHEME).toBe('soql-results');
  });
});

describe('generateMarkdown', () => {
  const docName = 'Query1.soql';

  it('produces a heading with the document name', () => {
    const qr: QueryResult<JsonMap> = { done: true, totalSize: 0, records: [] };
    const md = generateMarkdown(docName, qr);
    expect(md).toContain('# Query1.soql');
  });

  it('shows returned vs total record count', () => {
    const qr: QueryResult<JsonMap> = { done: false, totalSize: 6416, records: [{ Id: '001' }] };
    const md = generateMarkdown(docName, qr);
    expect(md).toContain('Returned 1 of 6416 total records');
  });

  it('shows no-records message when records array is empty', () => {
    const qr: QueryResult<JsonMap> = { done: true, totalSize: 0, records: [] };
    const md = generateMarkdown(docName, qr);
    expect(md).toContain('_No records found._');
    expect(md).not.toContain('|');
  });

  it('renders a markdown table with column headers and rows', () => {
    const qr: QueryResult<JsonMap> = {
      done: true,
      totalSize: 2,
      records: [
        { Id: '001', Name: 'Acme' },
        { Id: '002', Name: 'Globex' }
      ]
    };
    const md = generateMarkdown(docName, qr);
    expect(md).toContain('| Id | Name |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| 001 | Acme |');
    expect(md).toContain('| 002 | Globex |');
  });

  it('escapes pipe characters in cell values', () => {
    const qr: QueryResult<JsonMap> = {
      done: true,
      totalSize: 1,
      records: [{ Name: 'foo|bar' }]
    };
    const md = generateMarkdown(docName, qr);
    expect(md).toContain('foo\\|bar');
  });

  it('replaces newlines in cell values with spaces', () => {
    const qr: QueryResult<JsonMap> = {
      done: true,
      totalSize: 1,
      records: [{ Name: 'line1\nline2' }]
    };
    const md = generateMarkdown(docName, qr);
    expect(md).toContain('line1 line2');
    expect(md).not.toContain('line1\nline2');
  });
});

describe('QueryResultsMarkdownProvider', () => {
  const uri = URI.parse('soql-results:Query1.soql');
  const document = { uri: URI.file('/path/to/Query1.soql'), getText: () => '' } as unknown as vscode.TextDocument;
  const queryData: QueryResult<JsonMap> = {
    done: true,
    totalSize: 1,
    records: [{ Id: '001', Name: 'Acme' }]
  };

  it('returns empty string for unknown URI', () => {
    const provider = new QueryResultsMarkdownProvider();
    expect(provider.provideTextDocumentContent(uri)).toBe('');
  });

  it('returns markdown after update()', () => {
    const provider = new QueryResultsMarkdownProvider();
    provider.update(uri, queryData, 'Query1.soql', document);
    const content = provider.provideTextDocumentContent(uri);
    expect(content).toContain('# Query1.soql');
    expect(content).toContain('| Id | Name |');
  });

  it('fires onDidChange after update()', () => {
    const provider = new QueryResultsMarkdownProvider();
    const fired: vscode.Uri[] = [];
    provider.onDidChange(u => fired.push(u));
    provider.update(uri, queryData, 'Query1.soql', document);
    expect(fired).toHaveLength(1);
    expect(fired[0].toString()).toBe(uri.toString());
  });

  it('getStoredResult returns stored query data and document', () => {
    const provider = new QueryResultsMarkdownProvider();
    provider.update(uri, queryData, 'Query1.soql', document);
    const stored = provider.getStoredResult(uri);
    expect(stored?.queryData).toBe(queryData);
    expect(stored?.document).toBe(document);
  });

  it('getStoredResult returns undefined for unknown URI', () => {
    const provider = new QueryResultsMarkdownProvider();
    expect(provider.getStoredResult(uri)).toBeUndefined();
  });
});
