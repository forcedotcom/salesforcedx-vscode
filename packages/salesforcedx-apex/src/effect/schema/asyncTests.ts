/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { TestRunId } from './salesforceId.js';
import { AsyncTestRunStatusSchema } from './wire/asyncTests.js';

const asyncTestRunSummarySchema = Schema.Struct({
  status: AsyncTestRunStatusSchema,
  classesCompleted: Schema.Number,
  classesEnqueued: Schema.Number
});
export type AsyncTestRunSummary = typeof asyncTestRunSummarySchema.Type;

/** Progress values contain domain data, not UI messages or VS Code progress shapes. */
export const AsyncTestProgressSchema = Schema.TaggedStruct('Progress', {
  ...asyncTestRunSummarySchema.fields
}).annotate({ identifier: 'AsyncTestProgress' });
export type AsyncTestProgress = typeof AsyncTestProgressSchema.Type;

export const AsyncTestResultSchema = Schema.TaggedStruct('Result', {
  testRunId: TestRunId,
  result: asyncTestRunSummarySchema
}).annotate({ identifier: 'AsyncTestResult' });

/** Progress updates followed by the terminal run summary. */
export const AsyncTestRunEventSchema = Schema.Union([AsyncTestProgressSchema, AsyncTestResultSchema]).annotate({
  identifier: 'AsyncTestRunEvent'
});
export type AsyncTestRunEvent = typeof AsyncTestRunEventSchema.Type;
