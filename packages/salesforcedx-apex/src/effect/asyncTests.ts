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
import type * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';

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

/** Payload accepted by the Tooling API asynchronous test endpoint. */
export const AsyncTestOptionsSchema = Schema.Struct({
  testLevel: testLevelSchema,
  classNames: Schema.optional(Schema.String),
  classids: Schema.optional(Schema.String),
  suiteNames: Schema.optional(Schema.String),
  suiteids: Schema.optional(Schema.String),
  tests: Schema.optional(
    Schema.Array(
      Schema.Struct({
        className: Schema.optional(Schema.String),
        classId: Schema.optional(Schema.String),
        testMethods: Schema.optional(Schema.Array(Schema.String)),
        namespace: Schema.optional(Schema.String),
        category: Schema.optional(Schema.String)
      })
    )
  ),
  maxFailedTests: Schema.optional(Schema.Number),
  skipCodeCoverage: Schema.optional(Schema.Boolean),
  category: Schema.optional(Schema.Array(Schema.String))
}).annotations({ identifier: 'AsyncTestOptions' });
export type AsyncTestOptions = typeof AsyncTestOptionsSchema.Type;

const summarySchema = Schema.Struct({
  Status: Schema.Literal('Queued', 'Processing', 'Aborted', 'Failed', 'Completed', 'Passed', 'Skipped'),
  ClassesCompleted: Schema.Number,
  ClassesEnqueued: Schema.Number
});
const summariesSchema = Schema.Struct({ records: Schema.Tuple(summarySchema) });
const queueRecordsSchema = Schema.Array(
  Schema.Struct({
    Id: salesforceIdSchema,
    Status: Schema.Literal('Queued', 'Holding', 'Preparing', 'Processing', 'Aborted', 'Completed', 'Failed')
  })
);
const queueSchema = Schema.Union(
  Schema.Struct({ done: Schema.Literal(true), records: queueRecordsSchema }),
  Schema.Struct({ done: Schema.Literal(false), records: queueRecordsSchema, nextRecordsUrl: Schema.String })
);
const updateResultSchema = Schema.Struct({ success: Schema.Boolean });
const finishedStatuses = HashSet.make('Aborted', 'Failed', 'Completed', 'Passed', 'Skipped');

/** Progress values contain domain data, not UI messages or VS Code progress shapes. */
export const AsyncTestProgressSchema = Schema.Union(
  Schema.TaggedStruct('Started', { testRunId: testRunIdSchema }),
  Schema.TaggedStruct('Progress', {
    testRunId: testRunIdSchema,
    status: summarySchema.fields.Status,
    classesCompleted: Schema.Number,
    classesEnqueued: Schema.Number
  })
).annotations({ identifier: 'AsyncTestProgress' });
export type AsyncTestProgress = typeof AsyncTestProgressSchema.Type;

const request = <A>(action: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(action()),
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
  // Fetch every page before updating: aborting a page can change the subsequent query results.
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
    Stream.runCollect,
    Effect.map(pages =>
      Array.from(pages)
        .flat()
        .filter(record => !HashSet.has(finishedStatuses, record.Status))
    ),
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

/**
 * Submits a test run when consumed, then polls until its terminal status.
 * Consume inside Effect.scoped. Closing that scope before completion aborts unfinished queue items.
 * Submission and cleanup are uninterruptible so interruption cannot lose an accepted run ID. Use exitOnTestRunId to
 * detach intentionally; caller deadlines cannot interrupt pending submission or cleanup. Callers own result/coverage retrieval.
 */
export const runTestAsynchronous = (
  connection: Connection,
  options: AsyncTestOptions,
  polling: { interval?: Duration.DurationInput; exitOnTestRunId?: boolean } = {}
): Stream.Stream<AsyncTestProgress, ApexOperationError | ApexResponseDecodeError, Scope.Scope> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const pending = yield* Ref.make(!polling.exitOnTestRunId);
      const testRunId = yield* Effect.acquireRelease(
        request(() =>
          connection.tooling.request({
            method: 'POST',
            url: `${connection.tooling._baseUrl()}/runTestsAsynchronous`,
            body: JSON.stringify(options),
            headers: { 'content-type': 'application/json' }
          })
        ).pipe(Effect.flatMap(response => decode(testRunIdSchema, response))),
        id =>
          Ref.get(pending).pipe(
            Effect.flatMap(shouldAbort => (shouldAbort ? abortTestRun(connection, id).pipe(Effect.orDie) : Effect.void))
          )
      );
      const started: AsyncTestProgress = { _tag: 'Started', testRunId };
      if (polling.exitOnTestRunId) return Stream.succeed(started);

      return Stream.succeed(started).pipe(
        Stream.concat(
          Stream.repeatEffectWithSchedule(
            request(() =>
              connection.tooling.query(
                `SELECT Status, ClassesCompleted, ClassesEnqueued FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`
              )
            ).pipe(
              Effect.flatMap(response => decode(summariesSchema, response)),
              Effect.tap(({ records: [summary] }) =>
                HashSet.has(finishedStatuses, summary.Status) ? Ref.set(pending, false) : Effect.void
              ),
              Effect.map(
                ({ records: [summary] }): AsyncTestProgress => ({
                  _tag: 'Progress',
                  testRunId,
                  status: summary.Status,
                  classesCompleted: summary.ClassesCompleted,
                  classesEnqueued: summary.ClassesEnqueued
                })
              )
            ),
            Schedule.spaced(polling.interval ?? Duration.seconds(1))
          ).pipe(
            Stream.takeUntil(progress => progress._tag === 'Progress' && HashSet.has(finishedStatuses, progress.status))
          )
        )
      );
    })
  ).pipe(Stream.withSpan('Apex.runTestAsynchronous'));
