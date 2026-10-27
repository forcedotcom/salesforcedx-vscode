/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const payloadOptions = {
  testLevel: Schema.Literal('RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests'),
  tests: Schema.optional(Schema.String),
  classNames: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  skipCodeCoverage: Schema.optional(Schema.Boolean)
};

export const BuildSyncPayloadOptionsSchema = Schema.Struct(payloadOptions).annotations({
  identifier: 'BuildSyncPayloadOptions'
});
export type BuildSyncPayloadOptions = typeof BuildSyncPayloadOptionsSchema.Type;

export const BuildAsyncPayloadOptionsSchema = Schema.Struct({
  ...payloadOptions,
  suiteNames: Schema.optional(Schema.String)
}).annotations({ identifier: 'BuildAsyncPayloadOptions' });
export type BuildAsyncPayloadOptions = typeof BuildAsyncPayloadOptionsSchema.Type;
