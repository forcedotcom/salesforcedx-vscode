/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString, ApexLogIdString } from '../schemas/salesforceId';

const SyncTestMethodFields = {
  id: ApexClassIdString,
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
  apexLogId: Schema.NullOr(ApexLogIdString),
  failures: Schema.Array(SyncTestFailureSchema),
  numFailures: Schema.Number,
  numTestsRun: Schema.Number,
  successes: Schema.Array(SyncTestSuccessSchema),
  totalTime: Schema.optionalWith(Schema.Number, { nullable: true, default: () => 0 })
}).annotations({ identifier: 'SyncTestResult' });
