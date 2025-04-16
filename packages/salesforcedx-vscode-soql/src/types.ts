/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core-bundle';

export type QueryResult<T> = Awaited<ReturnType<Connection['query']>> & {
  records: T[];
};
export type DescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;
