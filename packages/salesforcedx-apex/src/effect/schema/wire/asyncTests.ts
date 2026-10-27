/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, ApexClassIdsSchema, ApexTestSuiteIdsSchema, SalesforceId } from '../salesforceId';

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

/** Request body accepted by the Tooling API asynchronous test endpoint. */
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

const summarySchema = Schema.Struct({
  Status: AsyncTestRunStatusSchema,
  ClassesCompleted: Schema.Number,
  ClassesEnqueued: Schema.Number
});
export const summariesSchema = Schema.Struct({ records: Schema.Tuple(summarySchema) });

const queueRecordsSchema = Schema.Array(
  Schema.Struct({
    Id: SalesforceId,
    Status: Schema.Literal('Queued', 'Holding', 'Preparing', 'Processing', 'Aborted', 'Completed', 'Failed')
  })
);
export const queueSchema = Schema.Union(
  Schema.Struct({ done: Schema.Literal(true), records: queueRecordsSchema }),
  Schema.Struct({ done: Schema.Literal(false), records: queueRecordsSchema, nextRecordsUrl: Schema.String })
);

export const updateResultsSchema = Schema.Array(Schema.Struct({ success: Schema.Boolean }));
