/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as soqlComments from '@salesforce/soql-common/soqlComments';
import type { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';
import { nls } from '../messages';

const hasMessage = (obj: unknown): obj is { message: unknown } =>
  typeof obj === 'object' && obj !== null && 'message' in obj;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : hasMessage(error) ? String(error.message) : String(error);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type QueryResult<T> = Awaited<ReturnType<Connection['query']>>;

export const runQuery =
  (conn: Connection) =>
  async (queryText: string, options = { showErrors: true }): Promise<QueryResult<JsonMap>> => {
    const pureSOQLText = soqlComments.parseHeaderComments(queryText).soqlText;

    try {
      const rawQueryData = await conn.autoFetchQuery(pureSOQLText);
      return {
        ...rawQueryData,
        records: flattenQueryRecords(rawQueryData.records)
      };
    } catch (error) {
      if (options.showErrors) {
        const errorMsg = getErrorMessage(error);
        vscode.window.showErrorMessage(nls.localize('error_run_soql_query', errorMsg));
      }
      throw error;
    }
  };
/**
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and displayed correctly
 */
const flattenQueryRecords = (rawQueryRecords: JsonMap[]) =>
  // filter out the attributes key
  rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
