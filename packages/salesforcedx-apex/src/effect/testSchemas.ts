/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { isNull } from 'effect/Predicate';
import { ApexClassIdString, ApexLogIdString } from '../schemas/salesforceId.js';

const nullableNumberWithDefaultZero = Schema.NullOr(Schema.Number).pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(value => (isNull(value) ? 0 : value)),
    encode: SchemaGetter.transform(value => value)
  }),
  Schema.withDecodingDefaultType(Effect.succeed(0))
);

const SyncTestMethodFields = {
  id: ApexClassIdString,
  methodName: Schema.String,
  name: Schema.String,
  namespace: Schema.NullOr(Schema.String),
  seeAllData: Schema.Boolean,
  time: nullableNumberWithDefaultZero
};
const SyncTestSuccessSchema = Schema.Struct(SyncTestMethodFields);
const SyncTestFailureSchema = Schema.Struct({
  ...SyncTestMethodFields,
  message: Schema.optional(Schema.NullOr(Schema.String)),
  stackTrace: Schema.optional(Schema.NullOr(Schema.String)),
  type: Schema.String
});

/** Known fields from the Tooling runTestsSynchronous response. */
export const SyncTestResultSchema = Schema.Struct({
  apexLogId: Schema.NullOr(ApexLogIdString),
  failures: Schema.Array(SyncTestFailureSchema),
  numFailures: Schema.Number,
  numTestsRun: Schema.Number,
  successes: Schema.Array(SyncTestSuccessSchema),
  totalTime: nullableNumberWithDefaultZero
}).annotate({ identifier: 'SyncTestResult' });
