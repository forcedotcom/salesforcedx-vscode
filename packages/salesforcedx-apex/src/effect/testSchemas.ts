/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export {
  ApexTestResultDataSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultOutcomeSchema,
  ApexTestSetupDataSchema,
  TestResultRawSchema,
  TestResultSchema
} from '../tests/types';
export type { TestResultRaw, TestResult } from '../tests/types';

// Keep array mutability compatible with the existing class result types.
const StringArray = Schema.Array(Schema.String).pipe(Schema.mutable);

export const TestItemSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
  classId: Schema.optional(Schema.String),
  testMethods: Schema.optional(StringArray),
  namespace: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String)
}).annotations({ identifier: 'TestItem' });

export const SyncTestConfigurationSchema = Schema.Struct({
  classNames: Schema.optional(Schema.String),
  tests: TestItemSchema.pipe(Schema.Array, Schema.mutable, Schema.optional),
  testLevel: Schema.optional(Schema.String),
  maxFailedTests: Schema.optional(Schema.Number),
  skipCodeCoverage: Schema.optional(Schema.Boolean),
  category: Schema.optional(StringArray)
}).annotations({ identifier: 'SyncTestConfiguration' });
export type SyncTestConfiguration = typeof SyncTestConfigurationSchema.Type;

const SyncTestMethodFields = {
  id: Schema.String,
  methodName: Schema.String,
  name: Schema.String,
  namespace: Schema.NullOr(Schema.String),
  seeAllData: Schema.Boolean,
  time: Schema.optionalWith(Schema.Number, { nullable: true, default: () => 0 })
};
const SyncTestSuccessSchema = Schema.Struct(SyncTestMethodFields);
const SyncTestFailureSchema = Schema.Struct({
  ...SyncTestMethodFields,
  message: Schema.optionalWith(Schema.String, { nullable: true, default: () => '' }),
  stackTrace: Schema.optionalWith(Schema.String, { nullable: true, default: () => '' }),
  type: Schema.String
});

/** Known fields from the Tooling runTestsSynchronous response. */
export const SyncTestResultSchema = Schema.Struct({
  apexLogId: Schema.NullOr(Schema.String),
  failures: Schema.Array(SyncTestFailureSchema),
  numFailures: Schema.Number,
  numTestsRun: Schema.Number,
  successes: Schema.Array(SyncTestSuccessSchema),
  totalTime: Schema.optionalWith(Schema.Number, { nullable: true, default: () => 0 })
}).annotations({ identifier: 'SyncTestResult' });
