/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as vscode from 'vscode';

export class QueryRunner {
  constructor(
    private connection: Connection,
    private document?: vscode.TextDocument
  ) {}

  public async runQuery(queryText: string): Promise<JsonMap[]> {
    try {
      const rawQueryData = (await this.connection.query(
        queryText
      )) as QueryResult<JsonMap>;
      const cleanQueryRecords = this.flattenQueryData(rawQueryData);

      return cleanQueryRecords;
    } catch (error) {
      // TODO: Doc Review, i18n
      vscode.window.showErrorMessage(`Could not run the Query ${error}`);
      throw error;
    }
  }
  /*
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and diplayed correctly
  */
  private flattenQueryData(rawqQueryData: QueryResult<JsonMap>) {
    const records = rawqQueryData.records;
    // filter out the attributes key
    records.forEach(result => delete result.attributes);
    return records;
  }
}
