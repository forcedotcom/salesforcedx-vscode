/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { AsyncTestOptionsSchema, runTestAsynchronous } from '../../src/effect';

const testRunId = '707000000000001AAA';
const options = { testLevel: 'RunLocalTests' as const, category: ['Apex', 'Flow'] as const };
const summary = (Status: string, ClassesCompleted = 0) => ({
  records: [{ Status, ClassesCompleted, ClassesEnqueued: 2 }]
});
const makeConnection = () => {
  const tooling = {
    _baseUrl: () => 'https://example.my.salesforce.com/services/data/v65.0/tooling',
    request: vi.fn().mockResolvedValue(testRunId),
    query: vi.fn().mockResolvedValue(summary('Completed', 2)),
    queryMore: vi.fn(),
    update: vi
      .fn()
      .mockImplementation((_type: string, records: { Id: string }[]) =>
        Promise.resolve(records.map(() => ({ success: true })))
      )
  };
  return { tooling, connection: { tooling } as unknown as Connection };
};
const queue = (records: { Id: string; Status: string }[]) => ({ done: true, records });
const drainRun = (connection: Connection, polling: { interval?: Duration.DurationInput } = {}) =>
  runTestAsynchronous(connection, options, polling).pipe(
    Effect.flatMap(({ stream }) => Stream.runDrain(stream)),
    Effect.scoped
  );

describe('Effect asynchronous tests', () => {
  it('validates documented categories and comma-separated suite IDs', () => {
    const isValidOptions = Schema.is(AsyncTestOptionsSchema);
    const validOptions = {
      testLevel: 'RunSpecifiedTests',
      suiteids: '05F000000000001AAA,05F000000000002AAA',
      category: ['Apex', 'Flow'],
      tests: [{ className: 'ExampleTest', category: 'Apex' }]
    };

    expect(isValidOptions(validOptions)).toBe(true);
    expect(isValidOptions({ ...validOptions, category: ['Other'] })).toBe(false);
    expect(isValidOptions({ ...validOptions, suiteids: 'not-a-suite-id' })).toBe(false);
    expect(isValidOptions({ ...validOptions, tests: [{ className: 'ExampleTest', category: 'Other' }] })).toBe(false);
  });

  it('returns an ID before lazily polling class progress and emitting the terminal summary', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValueOnce(summary('Processing', 1)).mockResolvedValueOnce(summary('Completed', 2));
    let submittedId: string | undefined;
    const progress = await Effect.runPromise(
      runTestAsynchronous(connection, options, { interval: Duration.zero }).pipe(
        Effect.flatMap(run => {
          submittedId = run.id;
          expect(tooling.request).toHaveBeenCalledTimes(1);
          expect(tooling.query).not.toHaveBeenCalled();
          return Stream.runCollect(run.stream);
        }),
        Effect.scoped
      )
    );

    expect(submittedId).toBe(testRunId);
    expect(Array.from(progress)).toEqual([
      { _tag: 'Progress', status: 'Processing', classesCompleted: 1, classesEnqueued: 2 },
      {
        _tag: 'Result',
        testRunId,
        result: { status: 'Completed', classesCompleted: 2, classesEnqueued: 2 }
      }
    ]);
    expect(tooling.request).toHaveBeenCalledWith({
      method: 'POST',
      url: `${tooling._baseUrl()}/runTestsAsynchronous`,
      body: JSON.stringify(options),
      headers: { 'content-type': 'application/json' }
    });
    expect(tooling.query).toHaveBeenCalledTimes(2);
    expect(tooling.query.mock.calls.every(([query]) => query.includes('FROM ApexTestRunResult'))).toBe(true);
    expect(tooling.update).not.toHaveBeenCalled();
  });

  it.each(['Aborted', 'Failed', 'Completed', 'Passed', 'Skipped'])('stops at terminal status %s', async status => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValue(summary(status));
    await Effect.runPromise(drainRun(connection));
    expect(tooling.query).toHaveBeenCalledTimes(1);
    expect(tooling.update).not.toHaveBeenCalled();
  });

  it('aborts the run when its scope closes before the returned stream is consumed', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValue(queue([{ Id: '709000000000001AAA', Status: 'Queued' }]));
    const id = await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.map(run => run.id),
        Effect.scoped
      )
    );
    expect(id).toBe(testRunId);
    expect(tooling.request).toHaveBeenCalledTimes(1);
    expect(tooling.query).toHaveBeenCalledTimes(1);
    expect(tooling.update).toHaveBeenCalledWith(
      'ApexTestQueueItem',
      [{ Id: '709000000000001AAA', Status: 'Aborted' }],
      { allOrNone: false, allowRecursive: true }
    );
  });

  it('can explicitly cancel once and streams the terminal aborted summary', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query
      .mockResolvedValueOnce(queue([{ Id: '709000000000001AAA', Status: 'Processing' }]))
      .mockResolvedValueOnce(summary('Aborted'));

    const events = await Effect.runPromise(
      runTestAsynchronous(connection, options, { interval: Duration.zero }).pipe(
        Effect.flatMap(run =>
          Effect.gen(function* () {
            yield* run.cancel();
            yield* run.cancel();
            return yield* Stream.runCollect(run.stream);
          })
        ),
        Effect.scoped
      )
    );

    expect(Array.from(events)).toEqual([
      {
        _tag: 'Result',
        testRunId,
        result: { status: 'Aborted', classesCompleted: 0, classesEnqueued: 2 }
      }
    ]);
    expect(tooling.query).toHaveBeenCalledTimes(2);
    expect(tooling.update).toHaveBeenCalledWith(
      'ApexTestQueueItem',
      [{ Id: '709000000000001AAA', Status: 'Aborted' }],
      { allOrNone: false, allowRecursive: true }
    );
  });

  it('aborts all unfinished queue items across pages when the consumer closes early', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValueOnce(summary('Processing')).mockResolvedValueOnce({
      done: false,
      records: [
        { Id: '709000000000001AAA', Status: 'Queued' },
        { Id: '709000000000002AAA', Status: 'Completed' }
      ],
      nextRecordsUrl: '/next-page'
    });
    tooling.queryMore.mockResolvedValue(queue([{ Id: '709000000000003AAA', Status: 'Processing' }]));

    await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.flatMap(({ stream }) => stream.pipe(Stream.take(1), Stream.runDrain)),
        Effect.scoped
      )
    );

    expect(tooling.queryMore).toHaveBeenCalledWith('/next-page');
    expect(tooling.update.mock.calls).toEqual([
      [
        'ApexTestQueueItem',
        [
          { Id: '709000000000001AAA', Status: 'Aborted' },
          { Id: '709000000000003AAA', Status: 'Aborted' }
        ],
        { allOrNone: false, allowRecursive: true }
      ]
    ]);
  });

  it('interrupts polling immediately and waits for remote abort cleanup', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query
      .mockResolvedValueOnce(summary('Processing'))
      .mockResolvedValueOnce(queue([{ Id: '709000000000001AAA', Status: 'Processing' }]));

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const polled = yield* Deferred.make<void>();
        const run = yield* runTestAsynchronous(connection, options, { interval: Duration.hours(1) });
        const fiber = yield* run.stream.pipe(
          Stream.tap(() => Deferred.succeed(polled, undefined)),
          Stream.runDrain,
          Effect.scoped,
          Effect.fork
        );
        yield* Deferred.await(polled);
        return yield* Fiber.interrupt(fiber);
      }).pipe(Effect.scoped)
    );

    expect(Exit.isFailure(exit) && Cause.isInterrupted(exit.cause)).toBe(true);
    expect(tooling.update).toHaveBeenCalledWith(
      'ApexTestQueueItem',
      [{ Id: '709000000000001AAA', Status: 'Aborted' }],
      { allOrNone: false, allowRecursive: true }
    );
    expect(tooling.query).toHaveBeenCalledTimes(2);
  });

  it('does not lose the accepted run when interrupted during submission', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValue(queue([{ Id: '709000000000001AAA', Status: 'Queued' }]));

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const submitting = yield* Deferred.make<void>();
        const accepted = yield* Deferred.make<string>();
        tooling.request.mockImplementation(() =>
          Effect.runPromise(Deferred.succeed(submitting, undefined).pipe(Effect.andThen(Deferred.await(accepted))))
        );
        const fiber = yield* runTestAsynchronous(connection, options).pipe(Effect.scoped, Effect.fork);
        yield* Deferred.await(submitting);
        yield* Fiber.interruptFork(fiber);
        yield* Deferred.succeed(accepted, testRunId);
        return yield* Fiber.await(fiber);
      })
    );

    expect(Exit.isFailure(exit) && Cause.isInterrupted(exit.cause)).toBe(true);
    expect(tooling.update).toHaveBeenCalledWith(
      'ApexTestQueueItem',
      [{ Id: '709000000000001AAA', Status: 'Aborted' }],
      { allOrNone: false, allowRecursive: true }
    );
  });

  it('reports submission failures through the typed error channel', async () => {
    const { connection, tooling } = makeConnection();
    tooling.request.mockRejectedValue(new Error('submission failed'));
    const error = await Effect.runPromise(runTestAsynchronous(connection, options).pipe(Effect.flip, Effect.scoped));
    expect(error).toMatchObject({
      _tag: 'ApexOperationError',
      operation: 'runTestAsynchronous',
      cause: 'submission failed'
    });
    expect(tooling.query).not.toHaveBeenCalled();
  });

  it('reports malformed summaries and aborts the submitted run', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce(queue([{ Id: '709000000000001AAA', Status: 'Queued' }]));
    const error = await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.flatMap(({ stream }) => Stream.runDrain(stream)),
        Effect.scoped,
        Effect.flip
      )
    );
    expect(error).toMatchObject({ _tag: 'ApexResponseDecodeError', operation: 'runTestAsynchronous' });
    expect(tooling.update).toHaveBeenCalledWith(
      'ApexTestQueueItem',
      [{ Id: '709000000000001AAA', Status: 'Aborted' }],
      { allOrNone: false, allowRecursive: true }
    );
  });

  it('attempts every unfinished item across pages and reports all unsuccessful aborts', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValueOnce(summary('Processing')).mockResolvedValueOnce({
      done: false,
      records: [{ Id: '709000000000001AAA', Status: 'Queued' }],
      nextRecordsUrl: '/next-page'
    });
    tooling.queryMore.mockResolvedValue(
      queue([
        { Id: '709000000000002AAA', Status: 'Processing' },
        { Id: '709000000000003AAA', Status: 'Holding' }
      ])
    );
    tooling.update.mockResolvedValue([{ success: false }, { success: true }, { success: false }]);
    const exit = await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.flatMap(({ stream }) => stream.pipe(Stream.take(1), Stream.runDrain)),
        Effect.scoped,
        Effect.exit
      )
    );
    expect(tooling.update.mock.calls).toEqual([
      [
        'ApexTestQueueItem',
        [
          { Id: '709000000000001AAA', Status: 'Aborted' },
          { Id: '709000000000002AAA', Status: 'Aborted' },
          { Id: '709000000000003AAA', Status: 'Aborted' }
        ],
        { allOrNone: false, allowRecursive: true }
      ]
    ]);
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain(
      'Could not abort test queue item 709000000000001AAA'
    );
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain(
      'Could not abort test queue item 709000000000003AAA'
    );
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).not.toContain(
      'Could not abort test queue item 709000000000002AAA'
    );
  });

  it('submits every unfinished item even when the bulk abort request rejects', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query.mockResolvedValueOnce(summary('Processing')).mockResolvedValueOnce(
      queue([
        { Id: '709000000000001AAA', Status: 'Queued' },
        { Id: '709000000000002AAA', Status: 'Processing' }
      ])
    );
    tooling.update.mockRejectedValue(new Error('abort request failed'));
    const exit = await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.flatMap(({ stream }) => stream.pipe(Stream.take(1), Stream.runDrain)),
        Effect.scoped,
        Effect.exit
      )
    );
    expect(tooling.update.mock.calls).toEqual([
      [
        'ApexTestQueueItem',
        [
          { Id: '709000000000001AAA', Status: 'Aborted' },
          { Id: '709000000000002AAA', Status: 'Aborted' }
        ],
        { allOrNone: false, allowRecursive: true }
      ]
    ]);
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain('abort request failed');
  });

  it.each(['707000000000001', testRunId])('returns a Salesforce test-run ID %s', async id => {
    const { connection, tooling } = makeConnection();
    tooling.request.mockResolvedValue(id);
    tooling.query.mockResolvedValue(queue([]));
    const runId = await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.map(run => run.id),
        Effect.scoped
      )
    );
    expect(runId).toBe(id);
    expect(tooling.query).toHaveBeenCalledTimes(1);
    expect(tooling.query.mock.calls[0][0]).toContain('FROM ApexTestQueueItem');
  });

  it.each(['not-a-salesforce-id', '709000000000001AAA'])('rejects an invalid test-run ID %s', async id => {
    const { connection, tooling } = makeConnection();
    tooling.request.mockResolvedValue(id);
    const error = await Effect.runPromise(runTestAsynchronous(connection, options).pipe(Effect.flip, Effect.scoped));
    expect(error).toMatchObject({ _tag: 'ApexResponseDecodeError', operation: 'runTestAsynchronous' });
    expect(tooling.query).not.toHaveBeenCalled();
  });

  it('rejects malformed queue-item IDs before attempting aborts', async () => {
    const { connection, tooling } = makeConnection();
    tooling.query
      .mockResolvedValueOnce(summary('Processing'))
      .mockResolvedValueOnce(queue([{ Id: 'not-a-salesforce-id', Status: 'Queued' }]));
    const exit = await Effect.runPromise(
      runTestAsynchronous(connection, options).pipe(
        Effect.flatMap(({ stream }) => stream.pipe(Stream.take(1), Stream.runDrain)),
        Effect.scoped,
        Effect.exit
      )
    );
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain('Invalid asynchronous test response');
    expect(tooling.update).not.toHaveBeenCalled();
  });
});
