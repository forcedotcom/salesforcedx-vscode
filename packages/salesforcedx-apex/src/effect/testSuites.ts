/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import { messages } from '../i18n/i18n';
import { createRecord, queryRecords } from './records';
import { ApexOperationError } from './schema/errors';
import { TestSuiteMembershipSchema } from './schema/testSuites';
import {
  ApexClassIdQueryResponseSchema,
  TestSuiteIdQueryResponseSchema,
  TestSuiteRecordSchema
} from './schema/wire/testSuites';

const quote = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

/** Retrieves the suites in the caller's org. */
export const retrieveAllSuites = Effect.fn('Apex.retrieveAllSuites')(function* (connection: Connection) {
  return yield* queryRecords(
    connection,
    'retrieveAllSuites',
    'SELECT id, TestSuiteName FROM ApexTestSuite',
    TestSuiteRecordSchema,
    true
  );
});

export const retrieveSuiteId = Effect.fn('Apex.retrieveSuiteId')(function* (connection: Connection, suiteName: string) {
  return yield* queryRecords(
    connection,
    'retrieveSuiteId',
    `SELECT id FROM ApexTestSuite WHERE TestSuiteName = '${quote(suiteName)}'`,
    TestSuiteIdQueryResponseSchema,
    true
  ).pipe(Effect.map(records => records.at(0)?.Id));
});

/** Retrieves class membership by suite id. */
export const getTestsInSuite = Effect.fn('Apex.getTestsInSuite')(function* (connection: Connection, suiteId: string) {
  return yield* queryRecords(
    connection,
    'getTestsInSuite',
    `SELECT ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '${quote(suiteId)}'`,
    TestSuiteMembershipSchema,
    true
  );
});

/** Creates or extends a suite, leaving existing membership intact. */
export const buildSuite = Effect.fn('Apex.buildSuite')(function* (
  connection: Connection,
  suiteName: string,
  testClasses: readonly string[]
) {
  const suiteId = yield* retrieveSuiteId(connection, suiteName).pipe(
    Effect.flatMap(id =>
      // Recover an empty result, not a failed query.
      Effect.fromNullable(id).pipe(
        Effect.orElse(() =>
          createRecord(connection, 'buildSuite', 'ApexTestSuite', { TestSuiteName: suiteName }).pipe(
            Effect.map(record => record.id)
          )
        )
      )
    )
  );
  const [members, classes] = yield* Effect.all(
    [getTestsInSuite(connection, suiteId), getApexClassIds(connection, testClasses)],
    { concurrency: 'unbounded' }
  );
  yield* Effect.forEach(
    classes,
    (classId, index) =>
      members.some(member => member.ApexClassId === classId)
        ? Effect.log(messages.testSuiteMsg.replace('%s', testClasses[index]).replace('%s', suiteName))
        : createRecord(connection, 'buildSuite', 'TestSuiteMembership', {
            ApexClassId: classId,
            ApexTestSuiteId: suiteId
          }).pipe(
            Effect.tap(() =>
              Effect.log(messages.classSuiteMsg.replace('%s', testClasses[index]).replace('%s', suiteName))
            ),
            Effect.asVoid
          ),
    { concurrency: 'unbounded', discard: true }
  );
});

/** Resolves unpackaged names and namespace-qualified class names for suite membership. */
export const getApexClassIds = Effect.fn('Apex.getApexClassIds')(function* (
  connection: Connection,
  testClasses: readonly string[]
) {
  return yield* Effect.forEach(
    testClasses,
    testClass => {
      const dot = testClass.indexOf('.');
      const name = dot === -1 ? testClass : testClass.slice(dot + 1);
      const namespace =
        dot === -1
          ? "(NamespacePrefix = null OR NamespacePrefix = '')"
          : `NamespacePrefix = '${quote(testClass.slice(0, dot))}'`;
      return queryRecords(
        connection,
        'buildSuite',
        `SELECT Id FROM ApexClass WHERE Name = '${quote(name)}' AND ${namespace} LIMIT 1`,
        ApexClassIdQueryResponseSchema,
        true
      ).pipe(
        Effect.map(records => records.at(0)),
        Effect.filterOrFail(
          isNotUndefined,
          () =>
            new ApexOperationError({
              operation: 'buildSuite',
              message: messages.missingTestClassErr.replace('%s', testClass)
            })
        ),
        Effect.map(record => record.Id)
      );
    },
    { concurrency: 'unbounded' }
  );
});
