/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { SalesforceId } from '../salesforceId.js';

/** A minimal Salesforce query record containing its record ID. */
export const IdRecordSchema = Schema.Struct({ Id: SalesforceId });

/** Builds the Tooling/REST query response schema for a caller-provided record schema. */
export const queryRecordsResponseSchema = <S extends Schema.ConstraintDecoder<unknown, never>>(recordSchema: S) =>
  Schema.Struct({ records: Schema.Array(recordSchema) });

export const createRecordResponseSchema = Schema.Struct({ id: Schema.String });
