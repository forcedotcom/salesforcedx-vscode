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
import { ApexClassIdString } from '../../schemas/salesforceId';
import { TestLevelSchema } from '../../tests/types';

/** A selected test class, optionally restricted to named methods. */
export const TestItemSchema = Schema.Struct({
  /** Apex class name, including its namespace when needed (namespace.ClassName). */
  className: Schema.optional(Schema.NonEmptyTrimmedString),
  /** ApexClass record ID. */
  classId: Schema.optional(ApexClassIdString),
  /** Omit to run every test method in the class. */
  testMethods: Schema.NonEmptyTrimmedString.pipe(Schema.Array, Schema.mutable, Schema.optional),
  /** Namespace associated with the class or method. */
  namespace: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String)
}).pipe(
  Schema.mutable,
  Schema.filter(({ className, classId }) => isNotUndefined(className) !== isNotUndefined(classId), {
    identifier: 'TestItem',
    message: () => 'Specify either a test class name or an Apex class ID, not both',
    description: 'Exactly one of className or classId is required.'
  })
);

/** Synchronous selections identify exactly one class, allowing repeated selections and multiple methods. */
export const SyncTestItemsSchema = Schema.Array(TestItemSchema).pipe(
  Schema.mutable,
  Schema.minItems(1, { message: () => messages.syncClassErr }),
  Schema.filter(
    tests =>
      HashSet.size(
        HashSet.fromIterable(
          tests.map(({ className, classId }) => (isNotUndefined(className) ? `name:${className}` : `id:${classId}`))
        )
      ) === 1,
    {
      identifier: 'SyncTestItems',
      message: () => messages.syncClassErr,
      description: 'Every selection must refer to the same class name or ID; repeated selections are allowed.'
    }
  )
);

/** Tooling synchronous request; test selection and request limits are validated before sending. */
export const SyncTestConfigurationSchema = Schema.Struct({
  classNames: Schema.optional(
    Schema.NonEmptyTrimmedString.pipe(Schema.pattern(/^[^,]+$/, { message: () => messages.syncClassErr }))
  ),
  /** Only one distinct class is allowed for synchronous runs. */
  tests: Schema.optional(SyncTestItemsSchema),
  /** The only supported synchronous test level is RunSpecifiedTests. */
  testLevel: Schema.optional(
    Schema.String.pipe(
      Schema.filter((level): boolean => level === 'RunSpecifiedTests', {
        message: () => 'Synchronous tests require RunSpecifiedTests',
        jsonSchema: { enum: ['RunSpecifiedTests'] }
      })
    )
  ),
  /** Stop scheduling tests after this many failures; 0 stops after any failure. */
  maxFailedTests: Schema.optional(
    Schema.Int.pipe(Schema.between(0, 1_000_000)).annotations({
      message: () => ({ message: 'maxFailedTests must be an integer from 0 to 1,000,000', override: true })
    })
  ),
  /** Skip code coverage collection for a faster run. */
  skipCodeCoverage: Schema.optional(Schema.Boolean),
  /** Apex or Flow test categories. */
  category: Schema.NonEmptyTrimmedString.pipe(Schema.Array, Schema.minItems(1), Schema.mutable, Schema.optional)
}).pipe(
  Schema.mutable,
  Schema.filter(
    ({ tests, classNames, category }) =>
      isNotUndefined(tests) && isNotUndefined(classNames)
        ? { path: ['classNames'], message: 'Specify tests or classNames, not both' }
        : isNotUndefined(tests) || isNotUndefined(classNames) || isNotUndefined(category) || messages.payloadErr,
    {
      identifier: 'SyncTestConfiguration',
      description: 'Requires tests, classNames, or category. The tests and classNames selectors cannot be combined.'
    }
  )
);

const payloadOptions = {
  testLevel: TestLevelSchema,
  tests: Schema.optional(Schema.String),
  classNames: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  skipCodeCoverage: Schema.optional(Schema.Boolean)
};

export const BuildSyncPayloadOptionsSchema = Schema.Struct(payloadOptions).pipe(
  Schema.filter(({ tests, classNames, category }) => Boolean(tests || classNames || category), {
    identifier: 'BuildSyncPayloadOptions',
    message: () => messages.payloadErr,
    description: 'Requires a non-empty tests, classNames, or category selection.'
  })
);
export type BuildSyncPayloadOptions = typeof BuildSyncPayloadOptionsSchema.Type;

export const BuildAsyncPayloadOptionsSchema = Schema.Struct({
  ...payloadOptions,
  suiteNames: Schema.optional(Schema.String)
}).annotations({ identifier: 'BuildAsyncPayloadOptions' });
export type BuildAsyncPayloadOptions = typeof BuildAsyncPayloadOptionsSchema.Type;
