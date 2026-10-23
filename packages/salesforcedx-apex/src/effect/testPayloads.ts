/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { BuildAsyncPayloadOptions, BuildSyncPayloadOptions } from './schema/testPayloads';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Match from 'effect/Match';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { messages } from '../i18n/i18n';
import { ApexClassId } from '../schemas/salesforceId';
import {
  type AsyncTestArrayConfiguration,
  type AsyncTestConfiguration,
  type SyncTestConfiguration,
  type TestItem
} from '../tests/types';
import { ApexOperationError } from './errors';
import { queryNamespaces } from './namespaces';
import { parseDottedName, parseTestSelection, resolveTestSelection, testItemFromSelection } from './testSelection';

const classItem = (className: string): TestItem =>
  Match.value(parseDottedName(className)).pipe(
    Match.tag('UnqualifiedName', ({ name }) =>
      Schema.is(ApexClassId)(name) ? { classId: name } : { className: name }
    ),
    Match.tag('QualifiedName', ({ namespace, name }) => ({ className: `${namespace}.${name}` })),
    Match.exhaustive
  );

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
  const namespaceInfos = yield* Effect.cached(queryNamespaces(connection));
  const items = yield* Effect.forEach(
    testNames.split(','),
    Effect.fn('Apex.parseTestSelection')(function* (test) {
      const selection = parseTestSelection(test);
      return yield* Match.value(selection).pipe(
        Match.tag('AmbiguousApex', selection =>
          namespaceInfos.pipe(Effect.map(infos => resolveTestSelection(selection, infos)))
        ),
        Match.tag('AmbiguousFlow', selection =>
          namespaceInfos.pipe(Effect.map(infos => resolveTestSelection(selection, infos)))
        ),
        Match.tag('ApexClassId', selection => Effect.succeed(selection)),
        Match.tag('ApexClass', selection => Effect.succeed(selection)),
        Match.tag('ApexMethod', selection => Effect.succeed(selection)),
        Match.tag('FlowClass', selection => Effect.succeed(selection)),
        Match.tag('FlowMethod', selection => Effect.succeed(selection)),
        Match.exhaustive,
        Effect.map(testItemFromSelection)
      );
    })
  );
  const tests = items.reduce<TestItem[]>((grouped, item) => {
    const testMethods = item.testMethods;
    if (!isNotUndefined(testMethods)) return [...grouped, item];
    const existing = grouped.find(
      candidate => candidate.className === item.className && isNotUndefined(candidate.testMethods)
    );
    return existing
      ? grouped.map(candidate =>
          candidate === existing
            ? { ...candidate, testMethods: [...(candidate.testMethods ?? []), ...testMethods] }
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
  const classNames = HashSet.fromIterable(
    payload.tests.map(item => item.className).filter(Schema.is(Schema.NonEmptyString))
  );
  if (HashSet.size(classNames) !== 1) {
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
