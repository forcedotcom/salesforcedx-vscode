/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Builds the Tooling/REST query response schema for a caller-provided record schema. */
export const queryRecordsResponseSchema = <A, I, R>(recordSchema: Schema.Schema<A, I, R>) =>
  Schema.Struct({ records: Schema.Array(recordSchema) });

export const createRecordResponseSchema = Schema.Struct({ id: Schema.String });
