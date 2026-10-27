/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';
import { QueryPageSchema } from './querySchema';

const operation = 'runTestAsynchronous';
const salesforceIdSchema = Schema.String.pipe(
  Schema.pattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/),
  Schema.brand('@salesforce/apex-node/SalesforceId')
);
const testRunIdSchema = salesforceIdSchema.pipe(
  Schema.startsWith('707'),
  Schema.brand('@salesforce/apex-node/ApexTestRunId')
);
const testLevelSchema = Schema.Literal('RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests');
const testCategorySchema = Schema.Literal('Apex', 'Flow');
const apexClassIdPattern = '01p[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?';
const apexTestSuiteIdPattern = '05F[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?';
const apexClassIdSchema = Schema.String.pipe(
  Schema.pattern(new RegExp(`^${apexClassIdPattern}$`, 'u')),
  Schema.brand('@salesforce/apex-node/ApexClassId')
);
const classIdsSchema = Schema.String.pipe(
  Schema.pattern(new RegExp(`^${apexClassIdPattern}(?:,${apexClassIdPattern})*$`, 'u'))
);
const suiteIdsSchema = Schema.String.pipe(
  Schema.pattern(new RegExp(`^${apexTestSuiteIdPattern}(?:,${apexTestSuiteIdPattern})*$`, 'u'))
);

/** Payload accepted by the Tooling API asynchronous test endpoint. */
export const AsyncTestOptionsSchema = Schema.Struct({
  testLevel: testLevelSchema,
  classNames: Schema.optional(Schema.String),
  classids: Schema.optional(classIdsSchema),
  suiteNames: Schema.optional(Schema.String),
  suiteids: Schema.optional(suiteIdsSchema),
  tests: Schema.optional(
    Schema.Array(
      Schema.Struct({
        className: Schema.optional(Schema.String),
        classId: Schema.optional(apexClassIdSchema),
        testMethods: Schema.optional(Schema.Array(Schema.String)),
        namespace: Schema.optional(Schema.String),
        category: Schema.optional(testCategorySchema)
      })
    )
  ),
  maxFailedTests: Schema.optional(Schema.Number),
  skipCodeCoverage: Schema.optional(Schema.Boolean),
  category: Schema.optional(Schema.Array(testCategorySchema))
}).annotations({ identifier: 'AsyncTestOptions' });
export type AsyncTestOptions = typeof AsyncTestOptionsSchema.Type;

/** Override the default two-second delay between status queries. */
export type AsyncTestPollingOptions = {
  interval?: Duration.DurationInput;
};

const runStatusSchema = Schema.Literal('Queued', 'Processing', 'Aborted', 'Failed', 'Completed', 'Passed', 'Skipped');
const summarySchema = Schema.Struct({
  Status: runStatusSchema,
  ClassesCompleted: Schema.Number,
  ClassesEnqueued: Schema.Number
});
const summariesSchema = Schema.Struct({ records: Schema.Tuple(summarySchema) });
const queueRecordSchema = Schema.Struct({
  Id: salesforceIdSchema,
  Status: Schema.Literal('Queued', 'Holding', 'Preparing', 'Processing', 'Aborted', 'Completed', 'Failed')
});
const queueSchema = QueryPageSchema(queueRecordSchema);
const updateResultSchema = Schema.Struct({ success: Schema.Boolean });
const finishedStatuses = HashSet.make('Aborted', 'Failed', 'Completed', 'Passed', 'Skipped');
const DEFAULT_POLL_INTERVAL = Duration.seconds(2);

/** Progress values contain domain data, not UI messages or VS Code progress shapes. */
const asyncTestRunSummarySchema = Schema.Struct({
  status: runStatusSchema,
  classesCompleted: Schema.Number,
  classesEnqueued: Schema.Number
});
export type AsyncTestRunSummary = typeof asyncTestRunSummarySchema.Type;

export const AsyncTestProgressSchema = Schema.TaggedStruct('Progress', {
  ...asyncTestRunSummarySchema.fields
}).annotations({ identifier: 'AsyncTestProgress' });
export type AsyncTestProgress = typeof AsyncTestProgressSchema.Type;

export const AsyncTestResultSchema = Schema.TaggedStruct('Result', {
  testRunId: testRunIdSchema,
  result: asyncTestRunSummarySchema
}).annotations({ identifier: 'AsyncTestResult' });

/** Progress updates followed by the terminal run summary. */
export const AsyncTestRunEventSchema = Schema.Union(AsyncTestProgressSchema, AsyncTestResultSchema).annotations({
  identifier: 'AsyncTestRunEvent'
});
export type AsyncTestRunEvent = typeof AsyncTestRunEventSchema.Type;

/** The accepted Salesforce run ID and its lazy progress/result stream. */
export type AsyncTestRun = {
  readonly id: typeof testRunIdSchema.Type;
  readonly stream: Stream.Stream<AsyncTestRunEvent, ApexOperationError | ApexResponseDecodeError>;
  readonly cancel: () => Effect.Effect<void, ApexOperationError | ApexResponseDecodeError>;
};

const request = <A>(action: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: action,
    catch: cause => new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) })
  });

const decode = <A, I>(schema: Schema.Schema<A, I>, response: unknown) =>
  Schema.decodeUnknown(schema)(response).pipe(
    Effect.mapError(
      cause =>
        new ApexResponseDecodeError({
          operation,
          message: 'Invalid asynchronous test response',
          cause: causeMessage(cause)
        })
    )
  );

const abortTestRun = Effect.fn('Apex.abortTestRun')(function* (
  connection: Connection,
  testRunId: typeof testRunIdSchema.Type
) {
  // Fetch all pages before marking queue items Aborted; those updates can change later query results.
  yield* Stream.paginateEffect(Option.none<string>(), nextRecordsUrl =>
    request(() =>
      Option.match(nextRecordsUrl, {
        onNone: () =>
          connection.tooling.query(`SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`),
        onSome: url => connection.tooling.queryMore(url)
      })
    ).pipe(
      Effect.flatMap(response => decode(queueSchema, response)),
      Effect.map(
        page => [page.records, page.done ? Option.none() : Option.some(Option.some(page.nextRecordsUrl))] as const
      )
    )
  ).pipe(
    Stream.mapConcat(records => records),
    Stream.filter(record => !HashSet.has(finishedStatuses, record.Status)),
    Stream.runCollect,
    Effect.map(records => Array.from(records)),
    Effect.flatMap(records =>
      records.length === 0
        ? Effect.void
        : request(() =>
            connection.tooling.update(
              'ApexTestQueueItem',
              records.map(record => ({ Id: record.Id, Status: 'Aborted' })),
              { allOrNone: false, allowRecursive: true }
            )
          ).pipe(
            Effect.flatMap(response => decode(Schema.Array(updateResultSchema), response)),
            Effect.flatMap(results =>
              Effect.validateAll(
                results,
                (result, index) =>
                  result.success ? Effect.void : Effect.fail(`Could not abort test queue item ${records[index].Id}`),
                { discard: true }
              ).pipe(Effect.mapError(messages => new ApexOperationError({ operation, message: messages.join('; ') })))
            )
          )
    )
  );
});

const cancelTestRun = Effect.fn('Apex.cancelTestRun')(function* (
  connection: Connection,
  testRunId: typeof testRunIdSchema.Type,
  pending: Ref.Ref<boolean>
) {
  const shouldAbort = yield* Ref.getAndSet(pending, false);
  if (!shouldAbort) return;

  yield* abortTestRun(connection, testRunId).pipe(Effect.tapError(() => Ref.set(pending, true)));
});

const pollTestRun = (
  connection: Connection,
  testRunId: typeof testRunIdSchema.Type,
  polling: AsyncTestPollingOptions,
  pending: Ref.Ref<boolean>
): AsyncTestRun['stream'] =>
  Stream.repeatEffectWithSchedule(
    request(() =>
      connection.tooling.query(
        `SELECT Status, ClassesCompleted, ClassesEnqueued FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`
      )
    ).pipe(
      Effect.flatMap(response => decode(summariesSchema, response)),
      Effect.map(
        ({ records: [summary] }): AsyncTestProgress =>
          AsyncTestProgressSchema.make({
            status: summary.Status,
            classesCompleted: summary.ClassesCompleted,
            classesEnqueued: summary.ClassesEnqueued
          })
      )
    ),
    Schedule.spaced(polling.interval ?? DEFAULT_POLL_INTERVAL)
  ).pipe(
    Stream.takeUntil(event => HashSet.has(finishedStatuses, event.status)),
    Stream.flatMap(
      (event): Stream.Stream<AsyncTestRunEvent, ApexOperationError | ApexResponseDecodeError> =>
        HashSet.has(finishedStatuses, event.status)
          ? Stream.fromEffect(
              Ref.set(pending, false).pipe(
                Effect.as(
                  AsyncTestResultSchema.make({
                    testRunId,
                    result: {
                      status: event.status,
                      classesCompleted: event.classesCompleted,
                      classesEnqueued: event.classesEnqueued
                    }
                  })
                )
              )
            )
          : Stream.succeed(event)
    ),
    Stream.withSpan('Apex.pollTestRun')
  );

/** Submit an async run; poll lazily and abort it if the enclosing scope closes before the stream finishes. */
export const runTestAsynchronous = Effect.fn('Apex.runTestAsynchronous')(function* (
  connection: Connection,
  options: AsyncTestOptions,
  polling: AsyncTestPollingOptions = {}
) {
  const pending = yield* Ref.make(true);
  const id = yield* Effect.acquireRelease(
    request(() =>
      connection.tooling.request({
        method: 'POST',
        url: `${connection.tooling._baseUrl()}/runTestsAsynchronous`,
        body: JSON.stringify(options),
        headers: { 'content-type': 'application/json' }
      })
    ).pipe(Effect.flatMap(response => decode(testRunIdSchema, response))),
    testRunId => cancelTestRun(connection, testRunId, pending).pipe(Effect.orDie)
  );
  return {
    id,
    stream: pollTestRun(connection, id, polling, pending),
    cancel: () => cancelTestRun(connection, id, pending)
  } satisfies AsyncTestRun;
});
