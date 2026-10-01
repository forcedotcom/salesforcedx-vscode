/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SelectAnalyzer } from '@salesforce/soql-model';
import { QueryResultPayload, QueryResultViewModel } from './queryResultOutput';

export const toQueryResultViewModel = (queryText: string, payload: QueryResultPayload): QueryResultViewModel => ({
  ...payload,
  queryText,
  columnData: new SelectAnalyzer(queryText).getColumnData()
});
