/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { stripAllRows as stripAllRowsModel } from '@salesforce/soql-model';

/**
 * Detects a trailing `ALL ROWS` clause on a SOQL string, strips it, and reports whether it was present.
 * The `/queryAll` REST/Tooling endpoint rejects literal `ALL ROWS` text, so callers send the stripped
 * `soql` with `{ scanAll }` to route to `/queryAll` instead. Delegates to the canonical strip/detect helper
 * in `@salesforce/soql-model`, mapping its `allRows` flag to jsforce's `scanAll` query option.
 */
export const stripAllRows = (soql: string): { soql: string; scanAll: boolean } => {
  const { soql: stripped, allRows } = stripAllRowsModel(soql);
  return { soql: stripped, scanAll: allRows };
};
