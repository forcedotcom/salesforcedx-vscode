/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Org rejected the SOQL statement (`MALFORMED_QUERY`, `INVALID_TYPE`, …). */
export class SoqlError extends Schema.TaggedError<SoqlError>()('SoqlError', {
  soql: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.Number,
  message: Schema.String
}) {}

/** Field-level SOQL failure (`INVALID_FIELD`, …) with named `fields` and `soql`. */
export class FieldError extends Schema.TaggedError<FieldError>()('FieldError', {
  soql: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.Number,
  message: Schema.String,
  fields: Schema.Array(Schema.String)
}) {}
