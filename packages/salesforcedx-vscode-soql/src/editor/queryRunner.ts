import { Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

export class QueryRunner {
  constructor(
    private connection: Connection,
    private context?: vscode.ExtensionContext
  ) {}

  // TODO: handle types better? this returns a jsonMap[], type comes from QueryResult<T>
  public async runQuery(queryText: string) {
    try {
      const rawQueryData = (await this.connection.query(
        queryText
      )) as QueryResult<JsonMap>;
      const cleanQueryRecords = this.flattenQueryData(rawQueryData);

      return cleanQueryRecords;
    } catch (error) {
      console.log('runQuery error', JSON.stringify(error, null, 2));
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

  protected saveQueryDataToFile(queryData: JsonMap) {}
}
