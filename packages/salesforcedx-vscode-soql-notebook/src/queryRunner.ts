/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parseHeaderComments } from '@salesforce/soql-common';
import { stripAllRows } from '@salesforce/soql-model';
import * as vscode from 'vscode';
import { nls } from './messages';
import { QueryResultPayload, toQueryResultPayload } from './queryResultOutput';

export type QueryApi = 'rest' | 'tooling';

export type QueryConnection = {
  query: (
    soql: string,
    options: { autoFetch: boolean; maxFetch: number; scanAll: boolean }
  ) => Promise<QueryResultPayload>;
  toolingQuery: (
    soql: string,
    options: { autoFetch: boolean; maxFetch: number; scanAll: boolean }
  ) => Promise<QueryResultPayload>;
};

export type QueryRunnerDeps = {
  getConnection: () => Promise<QueryConnection>;
  getMaxQueryLimit: () => number;
};

export const DEFAULT_MAX_QUERY_LIMIT = 50_000;

export const getMaxQueryLimit = (): number =>
  vscode.workspace
    .getConfiguration('salesforcedx-vscode-soql-notebook')
    .get<number>('maxQueryLimit') ?? DEFAULT_MAX_QUERY_LIMIT;

export const runSoqlCellQuery = async (
  queryText: string,
  api: QueryApi,
  deps: QueryRunnerDeps
): Promise<QueryResultPayload> => {
  const { soql, allRows } = stripAllRows(parseHeaderComments(queryText).soqlText);
  if (!soql.trim()) {
    throw new Error(nls.localize('empty_query'));
  }

  const connection = await deps.getConnection();
  const query = api === 'tooling' ? connection.toolingQuery : connection.query;
  const result = await query(soql, {
    autoFetch: true,
    maxFetch: deps.getMaxQueryLimit(),
    scanAll: allRows
  });
  return toQueryResultPayload(result);
};
