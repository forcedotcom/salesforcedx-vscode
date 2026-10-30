/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Array from 'effect/Array';
import * as Effect from 'effect/Effect';
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
import {
  type BuildAsyncPayloadOptions,
  type BuildSyncPayloadOptions,
  SyncTestItemsSchema
} from './schema/testPayloads';
import { parseDottedName, parseTestSelection, resolveTestSelection, testItemFromSelection } from './testSelection';

const classItem = (className: string): TestItem =>
  Match.value(parseDottedName(className.trim())).pipe(
    Match.tag('UnqualifiedName', ({ name }) =>
      Schema.is(ApexClassId)(name) ? { classId: name } : { className: name }
    ),
    Match.tag('QualifiedName', ({ namespace, name }) => ({ className: `${namespace}.${name}` })),
    Match.exhaustive
  );

const classPayload = (classNames: string, skipCodeCoverage: boolean, flow: boolean): AsyncTestArrayConfiguration => ({
  tests: classNames.split(',').map(name => (flow ? { className: name.trim() } : classItem(name))),
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
  return yield* Effect.forEach(
    testNames.split(','),
    Effect.fn('Apex.parseTestSelection')(function* (test) {
      const selection = parseTestSelection(test.trim());
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
  ).pipe(
    Effect.map(
      items =>
        ({
          tests: Array.map(
            Object.values(
              Array.groupBy(
                items.map((item, index) => ({ item, index })),
                ({ item, index }) => (isNotUndefined(item.testMethods) ? `class:${item.className}` : `item:${index}`)
              )
            ),
            group =>
              group.length === 1
                ? group[0].item
                : {
                    ...group[0].item,
                    testMethods: Array.flatMap(group, ({ item }) => item.testMethods ?? [])
                  }
          ),
          testLevel: 'RunSpecifiedTests',
          skipCodeCoverage
        }) satisfies AsyncTestArrayConfiguration
    )
  );
});

/** Builds a synchronous runner payload without executing tests. */
export const buildSyncPayload = Effect.fn('Apex.buildSyncPayload')(
  function* (connection: Connection, options: BuildSyncPayloadOptions) {
    const { testLevel, tests, classNames, category, skipCodeCoverage = false } = options;
    if (tests) return yield* buildTestPayload(connection, tests, skipCodeCoverage);
    if (classNames && category) return classPayload(classNames, skipCodeCoverage, true);
    if (classNames)
      return {
        tests: classNames.split(',').map(classItem),
        testLevel,
        skipCodeCoverage
      } satisfies SyncTestConfiguration;
    if (category) return { testLevel, category: category.split(','), skipCodeCoverage } satisfies SyncTestConfiguration;
    return yield* new ApexOperationError({
      operation: 'buildSyncPayload',
      message: messages.payloadErr
    });
  },
  Effect.tap(payload => ('tests' in payload ? Schema.decodeUnknown(SyncTestItemsSchema)(payload.tests) : Effect.void)),
  Effect.catchTag('ParseError', cause =>
    Effect.fail(new ApexOperationError({ operation: 'buildSyncPayload', message: cause.message }))
  )
);

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
