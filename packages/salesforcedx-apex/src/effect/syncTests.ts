/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { OrgIdString, UserIdString } from '../schemas/salesforceId';
import { type ApexTestResultData, type SyncTestConfiguration, type TestResultRaw } from '../tests/types';
import { getDiagnostic } from './diagnostics';
import { causeMessage } from './errors';
import { ApexOperationError, ApexResponseDecodeError } from './schema/errors';
import { SyncTestConfigurationSchema } from './schema/testPayloads';
import { calculatePercentage, computeTestCategory, transformTestResult } from './testResults';
import { SyncTestResultSchema } from './testSchemas';

const operation = 'runTestSynchronous';
type SyncTestResult = typeof SyncTestResultSchema.Type;

const processTestResult = (
  item: SyncTestResult['successes'][number] | SyncTestResult['failures'][number],
  apexLogId: SyncTestResult['apexLogId'],
  outcome: 'Pass' | 'Fail'
): ApexTestResultData => {
  const failure = 'type' in item ? item : undefined;
  const namespace = item.namespace ? (outcome === 'Fail' ? `${item.namespace}__` : `${item.namespace}.`) : '';
  return {
    ...(failure?.stackTrace ? { stackTrace: failure.stackTrace } : {}),
    ...(failure?.message ? { message: failure.message } : {}),
    methodName: item.methodName,
    outcome,
    apexLogId,
    apexClass: {
      id: item.id,
      name: item.name,
      ...(item.namespace ? { namespacePrefix: item.namespace } : {}),
      fullName: `${namespace}${item.name}`
    },
    runTime: item.time,
    fullName: `${namespace}${item.name}.${item.methodName}`,
    category: computeTestCategory(item.namespace),
    ...(failure && (failure.message || failure.stackTrace) ? { diagnostic: getDiagnostic(failure) } : {})
  };
};

/** Normalizes a Tooling response without files, editor diagnostics, or terminal output. */
export const formatSyncResults = Effect.fn('Apex.formatSyncResults')(function* (
  connection: Connection,
  response: unknown,
  startTime: number
) {
  const result = yield* Schema.decodeUnknown(SyncTestResultSchema)(response).pipe(
    Effect.catchTag('ParseError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({
          operation,
          message: cause.message,
          cause: causeMessage(cause)
        })
      )
    )
  );
  const passed = result.successes.length;
  const failed = result.failures.length;
  const username = connection.getUsername();
  const userId = connection.getConnectionOptions().userId;
  const orgId = yield* Schema.decodeUnknown(OrgIdString)(connection.getAuthInfoFields().orgId).pipe(
    Effect.mapError(
      cause =>
        new ApexResponseDecodeError({
          operation,
          message: cause.message,
          cause: causeMessage(cause)
        })
    )
  );
  const decodedUserId = isUndefined(userId)
    ? undefined
    : yield* Schema.decodeUnknown(UserIdString)(userId).pipe(
        Effect.mapError(
          cause =>
            new ApexResponseDecodeError({
              operation,
              message: cause.message,
              cause: causeMessage(cause)
            })
        )
      );
  const rawResult: TestResultRaw = {
    summary: {
      outcome: failed === 0 ? 'Passed' : 'Failed',
      testsRan: result.numTestsRun,
      passing: passed,
      failing: failed,
      skipped: 0,
      passRate: calculatePercentage(passed, result.numTestsRun),
      failRate: calculatePercentage(failed, result.numTestsRun),
      skipRate: calculatePercentage(0, result.numTestsRun),
      testStartTime: startTime ? new Date(startTime).toISOString() : '',
      testExecutionTimeInMs: result.totalTime,
      testTotalTimeInMs: result.totalTime,
      commandTimeInMs: (yield* Clock.currentTimeMillis) - startTime,
      hostname: connection.instanceUrl,
      orgId,
      ...(username ? { username } : {}),
      ...(decodedUserId ? { userId: decodedUserId } : {})
    },
    tests: [
      ...result.successes.map(item => processTestResult(item, result.apexLogId, 'Pass')),
      ...result.failures.map(item => processTestResult(item, result.apexLogId, 'Fail'))
    ]
  };
  return transformTestResult(rawResult);
});

/** Shared request for the Effect operation and the Promise adapter. @internal */
export const requestSyncTests = Effect.fn('Apex.requestSyncTests')(function* (
  connection: Connection,
  options: SyncTestConfiguration
) {
  yield* Schema.decodeUnknown(SyncTestConfigurationSchema)(options).pipe(
    Effect.catchTag('ParseError', cause =>
      Effect.fail(new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) }))
    )
  );
  return yield* Effect.tryPromise({
    try: async () =>
      connection.tooling.request<unknown>({
        method: 'POST',
        url: `${connection.tooling._baseUrl()}/runTestsSynchronous`,
        body: JSON.stringify(options),
        headers: { 'content-type': 'application/json' }
      }),
    catch: cause => new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) })
  });
});

/** Executes tests using a caller-selected connection; failed tests remain result data. */
export const runTestSynchronous = Effect.fn('Apex.runTestSynchronous')(
  (connection: Connection, options: SyncTestConfiguration) =>
    Clock.currentTimeMillis.pipe(
      Effect.flatMap(startTime =>
        requestSyncTests(connection, options).pipe(
          Effect.flatMap(response => formatSyncResults(connection, response, startTime))
        )
      )
    )
);
