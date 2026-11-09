/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, ApexTestQueueItemId } from '../../../schemas/salesforceId';
import { ApexClassIdsSchema, ApexTestSuiteIdsSchema } from '../salesforceId';

const testLevelSchema = Schema.Literal('RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests');
const testCategorySchema = Schema.Literal('Apex', 'Flow');
export const AsyncTestRunStatusSchema = Schema.Literal(
  'Queued',
  'Processing',
  'Aborted',
  'Failed',
  'Completed',
  'Passed',
  'Skipped'
);

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
}).annotations({ identifier: 'AsyncTestOptions' });
export type AsyncTestOptions = typeof AsyncTestOptionsSchema.Type;

export const ApexTestRunSummarySchema = Schema.Struct({
  Status: AsyncTestRunStatusSchema,
  ClassesCompleted: Schema.optionalWith(Schema.Number, { default: () => 0, nullable: true }),
  ClassesEnqueued: Schema.optionalWith(Schema.Number, { default: () => 0, nullable: true })
}).annotations({ identifier: 'ApexTestRunSummary' });
export const summariesSchema = Schema.Struct({ records: Schema.Tuple(ApexTestRunSummarySchema) });

export const ApexTestQueueItemStatusSchema = Schema.Literal(
  'Holding',
  'Queued',
  'Preparing',
  'Processing',
  'Aborted',
  'Completed',
  'Failed'
).annotations({ identifier: 'ApexTestQueueItemStatus' });

const queueRecordFields = {
  Id: ApexTestQueueItemId,
  Status: ApexTestQueueItemStatusSchema
};

export const ApexTestQueueItemRecordSchema = Schema.Struct({
  ...queueRecordFields,
  ApexClassId: Schema.NullOr(ApexClassId),
  TestRunResultId: Schema.String
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'ApexTestQueueItemRecord' });

export const queueRecordSchema = Schema.Struct(queueRecordFields);

export const updateResultsSchema = Schema.Array(Schema.Struct({ success: Schema.Boolean }));
