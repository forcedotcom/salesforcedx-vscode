/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { QueryResult } from '../types';
import { ColumnData, SelectAnalyzer } from '@salesforce/soql-model';
import type { JsonMap } from '@salesforce/ts-types';

type ExtendedQueryData = QueryResult<JsonMap> & {
  columnData: ColumnData;
};

export const extendQueryData = (queryText: string, queryData: QueryResult<JsonMap>): ExtendedQueryData => ({
  ...queryData,
  columnData: new SelectAnalyzer(queryText).getColumnData()
});
