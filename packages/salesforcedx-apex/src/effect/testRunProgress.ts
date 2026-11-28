/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Schema from 'effect/Schema';
import { type TestRunId } from '../schemas/salesforceId';
import { AsyncTestProgressSchema } from './schema/asyncTests';
import { ApexOperationError, ApexResponseDecodeError } from './schema/errors';
import { summariesSchema } from './schema/wire/asyncTests';

const finishedStatuses = HashSet.make('Aborted', 'Failed', 'Completed', 'Passed', 'Skipped');

export const isTestRunFinished = (status: string): boolean => HashSet.has(finishedStatuses, status);

/** Shared status query for the Promise and Effect asynchronous test APIs. */
export const getTestRunProgress = Effect.fn('Apex.getTestRunProgress')(function* (
  connection: Connection,
  testRunId: TestRunId
) {
  return yield* Effect.tryPromise({
    try: () =>
      connection.tooling.query(
        `SELECT Status, ClassesCompleted, ClassesEnqueued FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`
      ),
    catch: cause =>
      new ApexOperationError({
        operation: 'runTestAsynchronous',
        message: getErrorMessage(cause),
        cause: getErrorMessage(cause)
      })
  }).pipe(
    Effect.flatMap(response =>
      Schema.decodeUnknown(summariesSchema)(response).pipe(
        Effect.mapError(
          cause =>
            new ApexResponseDecodeError({
              operation: 'runTestAsynchronous',
              message: 'Invalid asynchronous test response',
              cause: cause.message
            })
        )
      )
    ),
    Effect.map(({ records: [summary] }) =>
      AsyncTestProgressSchema.make({
        status: summary.Status,
        classesCompleted: summary.ClassesCompleted,
        classesEnqueued: summary.ClassesEnqueued
      })
    )
  );
});
