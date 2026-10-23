/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  SyncTestConfiguration,
  TestItem
} from '../tests/types';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { messages } from '../i18n/i18n';
import { ApexClassId } from '../schemas/salesforceId';
import { ApexOperationError } from './errors';
import { queryNamespaces } from './namespaces';

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

const classItem = (className: string): TestItem => {
  const parts = className.split('.');
  return parts.length > 1
    ? { className: `${parts[0]}.${parts[1]}` }
    : Schema.is(ApexClassId)(className)
      ? { classId: className }
      : { className };
};

const classPayload = (classNames: string, skipCodeCoverage: boolean, flow: boolean): AsyncTestArrayConfiguration => ({
  tests: classNames.split(',').map(name => (flow ? { className: name } : classItem(name))),
  testLevel: 'RunSpecifiedTests',
  skipCodeCoverage
});

const buildTestPayload = Effect.fn('Apex.buildTestPayload')(function* (
  connection: Connection,
  testNames: string,
  skipCodeCoverage: boolean
) {
  // Two-part Apex names and three-part Flow names need org data to distinguish a namespace from a class.
  const namespaces = yield* Effect.cached(queryNamespaces(connection));
  const items = yield* Effect.forEach(
    testNames.split(','),
    Effect.fn('Apex.parseTestSelection')(function* (test) {
      if (test.indexOf('.') <= 0) {
        return Schema.is(ApexClassId)(test) ? { classId: test } : { className: test };
      }
      const parts = test.split('.');
      const flow = test.startsWith('FlowTesting.');
      const qualifiedMethod = parts.length === (flow ? 4 : 3);
      const namespaceIndex = flow ? 1 : 0;
      const namespace = qualifiedMethod
        ? undefined
        : (yield* namespaces).find(record => record.namespace === parts[namespaceIndex]);
      if (namespace) {
        return {
          className: parts.join('.'),
          // The org namespace must be explicit for Flow class selections; installed namespaces need no extra field.
          ...(flow && !namespace.installedNs && { namespace: parts.slice(0, 2).join('.') })
        };
      }
      const className = parts.slice(0, qualifiedMethod ? -1 : flow ? 2 : 1).join('.');
      const method = parts[qualifiedMethod ? parts.length - 1 : flow ? 2 : 1];
      return {
        className,
        testMethods: [method],
        ...(flow && qualifiedMethod && { namespace: parts.slice(0, 2).join('.') })
      };
    })
  );
  const tests = items.reduce<TestItem[]>((grouped, item) => {
    if (!('testMethods' in item)) return [...grouped, item];
    const existing = grouped.find(
      candidate => candidate.className === item.className && isNotUndefined(candidate.testMethods)
    );
    return existing
      ? grouped.map(candidate =>
          candidate === existing
            ? { ...candidate, testMethods: [...(candidate.testMethods ?? []), ...item.testMethods] }
            : candidate
        )
      : [...grouped, item];
  }, []);
  return { tests, testLevel: 'RunSpecifiedTests', skipCodeCoverage } satisfies AsyncTestArrayConfiguration;
});

/** Builds a synchronous runner payload without executing tests. */
export const buildSyncPayload = Effect.fn('Apex.buildSyncPayload')(function* (
  connection: Connection,
  options: BuildSyncPayloadOptions
) {
  const { testLevel, tests, classNames, category, skipCodeCoverage = false } = options;
  if (tests) {
    return yield* buildTestPayload(connection, tests, skipCodeCoverage).pipe(Effect.flatMap(validateSyncPayload));
  }
  if (classNames && category) {
    return yield* validateSyncPayload(classPayload(classNames, skipCodeCoverage, true));
  }
  if (classNames)
    return { tests: [classItem(classNames)], testLevel, skipCodeCoverage } satisfies SyncTestConfiguration;
  if (category) return { testLevel, category: category.split(','), skipCodeCoverage } satisfies SyncTestConfiguration;
  return yield* new ApexOperationError({
    operation: 'buildSyncPayload',
    message: messages.payloadErr
  });
});

const validateSyncPayload = Effect.fn('Apex.validateSyncPayload')(function* (payload: AsyncTestArrayConfiguration) {
  if (new Set(payload.tests.filter(item => item.className).map(item => item.className)).size !== 1) {
    return yield* new ApexOperationError({
      operation: 'buildSyncPayload',
      message: messages.syncClassErr
    });
  }
  return payload;
});

/** Builds an asynchronous runner payload without executing tests. */
export const buildAsyncPayload = Effect.fn('Apex.buildAsyncPayload')(function* (
  connection: Connection,
  options: BuildAsyncPayloadOptions
) {
  const { testLevel, tests, classNames, suiteNames, category, skipCodeCoverage = false } = options;
  if (tests) return yield* buildTestPayload(connection, tests, skipCodeCoverage);
  if (classNames) return classPayload(classNames, skipCodeCoverage, Boolean(category));
  return {
    suiteNames,
    testLevel,
    ...(category && { category: category.split(',') }),
    skipCodeCoverage
  } satisfies AsyncTestConfiguration;
});
