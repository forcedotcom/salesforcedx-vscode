/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parseHeaderComments } from '@salesforce/soql-common/soqlComments';
import { stripAllRows } from './editor/allRows';

/** Prepares SOQL for the query API without changing the source document. */
export const prepareQuery = (text: string): { soql: string; scanAll: boolean } =>
  stripAllRows(parseHeaderComments(text).soqlText.replace(/(?:;\s*)+$/, ''));
