/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { isNull } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { ApexClassId, ApexClassIdsSchema, ApexTestQueueItemId, ApexTestSuiteIdsSchema } from '../salesforceId.js';

const testLevelSchema = Schema.Literals(['RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests']);
const testCategorySchema = Schema.Literals(['Apex', 'Flow']);
export const AsyncTestRunStatusSchema = Schema.Literals([
  'Queued',
  'Processing',
  'Aborted',
  'Failed',
  'Completed',
  'Passed',
  'Skipped'
]);

/** Asynchronous request options; decoded ID lists are encoded as comma-separated strings for the API. */
export const AsyncTestOptionsSchema = Schema.Struct({
  testLevel: testLevelSchema,
  classNames: Schema.optional(Schema.String),
  classids: Schema.optional(ApexClassIdsSchema),
  suiteNames: Schema.optional(Schema.String),
  suiteids: Schema.optional(ApexTestSuiteIdsSchema),
  tests: Schema.optional(
    Schema.Array(
      Schema.Struct({
        className: Schema.optional(Schema.String),
        classId: Schema.optional(ApexClassId),
        testMethods: Schema.optional(Schema.Array(Schema.String)),
        namespace: Schema.optional(Schema.String),
        category: Schema.optional(testCategorySchema)
      })
    )
  ),
  maxFailedTests: Schema.optional(Schema.Number),
  skipCodeCoverage: Schema.optional(Schema.Boolean),
  category: Schema.optional(Schema.Array(testCategorySchema))
}).annotate({ identifier: 'AsyncTestOptions' });
export type AsyncTestOptions = typeof AsyncTestOptionsSchema.Type;

const nullableNumberWithDefaultZero = Schema.NullOr(Schema.Number).pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(value => (isNull(value) ? 0 : value)),
    encode: SchemaGetter.transform(value => value)
  }),
  Schema.withDecodingDefaultType(Effect.succeed(0))
);
export const ApexTestRunSummarySchema = Schema.Struct({
  Status: AsyncTestRunStatusSchema,
  ClassesCompleted: nullableNumberWithDefaultZero,
  ClassesEnqueued: nullableNumberWithDefaultZero
}).annotate({ identifier: 'ApexTestRunSummary' });
export const summariesSchema = Schema.Struct({ records: Schema.Tuple([ApexTestRunSummarySchema]) });

const queueRecordsSchema = Schema.Array(
  Schema.Struct({
    Id: ApexTestQueueItemId,
    Status: Schema.Literals(['Queued', 'Holding', 'Preparing', 'Processing', 'Aborted', 'Completed', 'Failed'])
  })
);
export const queueSchema = Schema.Union([
  Schema.Struct({ done: Schema.Literal(true), records: queueRecordsSchema }),
  Schema.Struct({ done: Schema.Literal(false), records: queueRecordsSchema, nextRecordsUrl: Schema.String })
]);

export const updateResultsSchema = Schema.Array(Schema.Struct({ success: Schema.Boolean }));
