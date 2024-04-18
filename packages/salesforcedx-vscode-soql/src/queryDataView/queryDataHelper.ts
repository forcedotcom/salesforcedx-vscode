/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ColumnData, SelectAnalyzer } from '@salesforce/soql-model';
import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';

export type ExtendedQueryData = QueryResult<JsonMap> & {
  columnData: ColumnData;
};

export function extendQueryData(
  queryText: string,
  queryData: QueryResult<JsonMap>
): ExtendedQueryData {
  return {
    ...queryData,
    columnData: new SelectAnalyzer(queryText).getColumnData()
  };
}
