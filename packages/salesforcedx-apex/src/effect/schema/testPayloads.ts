/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as HashSet from 'effect/HashSet';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { messages } from '../../i18n/i18n';
import { ApexClassId } from '../../schemas/salesforceId';
import { TestLevelSchema } from '../../tests/types';

/** Synchronous test selections identify exactly one class, by name or ID. */
export const SyncTestItemsSchema = Schema.Array(
  Schema.Struct({
    className: Schema.optional(Schema.NonEmptyTrimmedString),
    classId: Schema.optional(ApexClassId),
    testMethods: Schema.optional(Schema.Array(Schema.NonEmptyTrimmedString))
  })
    .pipe(Schema.filter(({ className, classId }) => isNotUndefined(className) !== isNotUndefined(classId)))
    .annotations({
      identifier: 'SyncTestItem',
      message: () => ({ message: messages.payloadErr, override: true })
    })
).pipe(
  Schema.filter(
    tests =>
      HashSet.size(
        HashSet.fromIterable(
          tests.map(({ className, classId }) => (isNotUndefined(className) ? `name:${className}` : `id:${classId}`))
        )
      ) === 1,
    { identifier: 'SyncTestItems', message: () => messages.syncClassErr }
  )
);

const payloadOptions = {
  testLevel: TestLevelSchema,
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
