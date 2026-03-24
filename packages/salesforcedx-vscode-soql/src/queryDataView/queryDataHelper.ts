/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { QueryResult } from '../types';
import { ColumnData, SelectAnalyzer } from '@salesforce/soql-model/analyzers/selectAnalyzer';
import type { JsonMap } from '@salesforce/ts-types';
import { getFlattenedSoqlGridPayload } from '../commands/dataQuery';

type FlattenedSoqlGridPayload = {
  fields: string[];
  rowData: Record<string, string>[];
};

type ExtendedQueryData = QueryResult<JsonMap> & {
  columnData: ColumnData;
  /** Pre-flattened rows/columns aligned with output-channel SOQL table (for webview Tabulator). */
  flattenedGrid?: FlattenedSoqlGridPayload;
};

export const extendQueryData = (queryText: string, queryData: QueryResult<JsonMap>): ExtendedQueryData => {
  const flattenedGrid = getFlattenedSoqlGridPayload(queryData.records);
  return {
    ...queryData,
    columnData: new SelectAnalyzer(queryText).getColumnData(),
    ...(flattenedGrid ? { flattenedGrid } : {})
  };
};
