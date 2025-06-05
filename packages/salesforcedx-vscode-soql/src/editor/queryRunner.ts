/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { soqlComments } from '@salesforce/soql-common';
import type { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';
import { nls } from '../messages';

type QueryResult<T> = Awaited<ReturnType<Connection['query']>>;

export const runQuery =
  (conn: Connection) =>
  async (queryText: string, options = { showErrors: true }): Promise<QueryResult<JsonMap>> => {
    const pureSOQLText = soqlComments.parseHeaderComments(queryText).soqlText;

    try {
      const rawQueryData = await conn.query(pureSOQLText);
      const cleanQueryData = {
        ...rawQueryData,
        records: flattenQueryRecords(rawQueryData.records)
      };
      return cleanQueryData;
    } catch (error) {
      // TODO: i18n
      if (options.showErrors) {
        const message = nls.localize('error_run_soql_query', error.message);
        vscode.window.showErrorMessage(message);
      }
      throw error;
    }
  };
/**
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and diplayed correctly
 */
const flattenQueryRecords = (rawQueryRecords: JsonMap[]) =>
  // filter out the attributes key
  rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
