import { Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as vscode from 'vscode';

export class QueryRunner {
  constructor(
    private connection: Connection,
    private document: vscode.TextDocument
  ) {}

  // TODO: provide some feedback to the user that the query is runing?
  public async runAndSaveQuery(queryText: string) {
    try {
      const rawQueryData = (await this.connection.query(
        queryText
      )) as QueryResult<JsonMap>;
      const cleanQueryRecords = this.flattenQueryData(rawQueryData);

      return cleanQueryRecords;
    } catch (error) {
      vscode.window.showErrorMessage(`Could not run the Query \n ${error}`); // TODO: Needs Doc Review handle errors from running query results with vscode core ext.
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
