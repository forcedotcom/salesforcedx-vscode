/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import type { Connection } from '@salesforce/core';
import * as soqlComments from '@salesforce/soql-common/soqlComments';
import type { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { stripAllRows } from './allRows';

const hasMessage = (obj: unknown): obj is { message: unknown } =>
  typeof obj === 'object' && obj !== null && 'message' in obj;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : hasMessage(error) ? String(error.message) : String(error);

export const runQuery =
  (conn: Connection) =>
  async (
    queryText: string,
    options: { showErrors?: boolean; maxRows?: number } = { showErrors: true }
  ): Promise<QueryResult<JsonMap>> => {
    const { maxRows } = options;
    const pureSOQLText = soqlComments.parseHeaderComments(queryText).soqlText;
    const { soql, scanAll } = stripAllRows(pureSOQLText);

    try {
      const rawQueryData = await conn.query(soql, { autoFetch: true, maxFetch: maxRows ?? 50_000, scanAll });
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
