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
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import { messages } from '../i18n/i18n';
import { type SalesforceId } from '../schemas/salesforceId';
import { ApexOperationError } from './errors';
import { createRecord, queryRecords } from './records';
import { TestSuiteMembershipSchema } from './schema/testSuites';
import {
  ApexClassIdQueryResponseSchema,
  TestSuiteIdQueryResponseSchema,
  TestSuiteRecordSchema
} from './schema/wire/testSuites';
import { parseDottedName } from './testSelection';

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
  ).pipe(Effect.map(records => Array.head(records).pipe(Option.map(record => record.Id))));
});

/** Retrieves class membership by suite id. */
export const getTestsInSuite = Effect.fn('Apex.getTestsInSuite')(function* (
  connection: Connection,
  suiteId: SalesforceId
) {
  return yield* queryRecords(
    connection,
    'getTestsInSuite',
    `SELECT ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '${quote(suiteId)}'`,
    TestSuiteMembershipSchema,
    true
  );
});

const updateSuiteMembership = Effect.fn('Apex.buildSuite.updateMembership')(function* (
  connection: Connection,
  suiteId: SalesforceId,
  suiteName: string,
  classId: SalesforceId,
  className: string,
  alreadyPresent: boolean
) {
  const annotations = { suiteId, suiteName, classId, className };
  if (alreadyPresent) {
    yield* Effect.annotateCurrentSpan({ ...annotations, membership: 'alreadyPresent' });
    return;
  }
  yield* Effect.annotateCurrentSpan({ ...annotations, membership: 'creating' });
  yield* createRecord(connection, 'buildSuite', 'TestSuiteMembership', {
    ApexClassId: classId,
    ApexTestSuiteId: suiteId
  }).pipe(Effect.asVoid);
  yield* Effect.annotateCurrentSpan({ membership: 'added' });
});

/** Creates or extends a suite, leaving existing membership intact. */
export const buildSuite = Effect.fn('Apex.buildSuite')(function* (
  connection: Connection,
  suiteName: string,
  testClasses: readonly string[]
) {
  const suiteId = yield* retrieveSuiteId(connection, suiteName).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          createRecord(connection, 'buildSuite', 'ApexTestSuite', { TestSuiteName: suiteName }).pipe(
            Effect.map(record => record.id)
          ),
        onSome: Effect.succeed
      })
    )
  );
  const [members, classes] = yield* Effect.all(
    [getTestsInSuite(connection, suiteId), getApexClassIds(connection, testClasses)],
    { concurrency: 'unbounded' }
  );
  yield* Effect.forEach(
    classes,
    (classId, index) =>
      updateSuiteMembership(
        connection,
        suiteId,
        suiteName,
        classId,
        testClasses[index],
        members.some(member => member.ApexClassId === classId)
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
      const { name, namespace } = Match.value(parseDottedName(testClass)).pipe(
        Match.tag('UnqualifiedName', ({ name }) => ({ name, namespace: undefined })),
        Match.tag('QualifiedName', ({ namespace, name, suffix }) => ({
          name: [name, ...suffix].join('.'),
          namespace
        })),
        Match.exhaustive
      );
      const namespaceFilter = isNotUndefined(namespace)
        ? `NamespacePrefix = '${quote(namespace)}'`
        : "(NamespacePrefix = null OR NamespacePrefix = '')";
      return queryRecords(
        connection,
        'buildSuite',
        `SELECT Id FROM ApexClass WHERE Name = '${quote(name)}' AND ${namespaceFilter} LIMIT 1`,
        ApexClassIdQueryResponseSchema,
        true
      ).pipe(
        Effect.map(Array.head),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                new ApexOperationError({
                  operation: 'buildSuite',
                  message: messages.missingTestClassErr.replace('%s', testClass)
                })
              ),
            onSome: record => Effect.succeed(record.Id)
          })
        )
      );
    },
    { concurrency: 'unbounded' }
  );
});
