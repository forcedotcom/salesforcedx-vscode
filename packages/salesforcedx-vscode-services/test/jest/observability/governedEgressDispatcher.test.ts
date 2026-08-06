/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import {
  GovernedEgressItem,
  GovernedEgressSink,
  makeGovernedEgressDispatcher
} from '../../../src/observability/governedEgressDispatcher';
import { OrgTelemetryClassification, OrgTelemetryPolicyState } from '../../../src/observability/orgTelemetryPolicy';

const makePolicy = () =>
  Effect.gen(function* () {
    const classifications = yield* Ref.make(HashMap.empty<string, OrgTelemetryClassification>());
    const changes = yield* Queue.unbounded<OrgTelemetryPolicyState>();
    return {
      policy: {
        getClassification: (orgId: string) =>
          Ref.get(classifications).pipe(
            Effect.map(values => HashMap.get(values, orgId).pipe(Option.getOrElse(() => 'unknown' as const)))
          ),
        changes: Stream.fromQueue(changes)
      },
      resolve: (orgId: string, classification: OrgTelemetryClassification) =>
        Ref.update(classifications, HashMap.set(orgId, classification)).pipe(
          Effect.zipRight(Queue.offer(changes, { orgId, classification })),
          Effect.asVoid
        )
    };
  });

const makeSink = (send: (item: GovernedEgressItem<number>) => Effect.Effect<void, unknown> = () => Effect.void) => {
  const sent: GovernedEgressItem<number>[] = [];
  const sink: GovernedEgressSink<number> = {
    send: item => Effect.sync(() => sent.push(item)).pipe(Effect.zipRight(send(item))),
    forceFlush: Effect.void,
    close: Effect.void
  };
  return { sent, sink };
};

const settle = Effect.yieldNow().pipe(Effect.zipRight(Effect.yieldNow()));

describe('makeGovernedEgressDispatcher', () => {
  it('drops missing-org and Gov items without constructing the sink', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('gov', 'gov');
      const make = jest.fn(() => makeSink().sink);
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.sync(make));

      expect(yield* dispatcher.submit({ orgId: undefined, payload: 1 })).toBe('dropped');
      expect(yield* dispatcher.submit({ orgId: 'gov', payload: 2 })).toBe('dropped');
      yield* dispatcher.close;
      expect(make).not.toHaveBeenCalled();
    });
    await Effect.runPromise(program);
  });

  it('sends nonGov directly and constructs the sink lazily once', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('org', 'nonGov');
      const { sent, sink } = makeSink();
      const make = jest.fn(() => sink);
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.sync(make));

      expect(yield* dispatcher.submit({ orgId: 'org', payload: 1 })).toBe('claimed');
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 2 })).toBe('claimed');
      yield* dispatcher.forceFlush;
      expect(sent.map(item => item.payload)).toEqual([1, 2]);
      expect(Object.isFrozen(sent[0])).toBe(true);
      expect(make).toHaveBeenCalledTimes(1);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('resolves pending items by org, preserving FIFO and leaving other orgs pending', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      const { sent, sink } = makeSink();
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      yield* dispatcher.submit({ orgId: 'a', payload: 1 });
      yield* dispatcher.submit({ orgId: 'b', payload: 2 });
      yield* dispatcher.submit({ orgId: 'a', payload: 3 });

      yield* harness.resolve('a', 'nonGov');
      yield* settle;
      yield* dispatcher.forceFlush;
      expect(sent.map(item => item.payload)).toEqual([1, 3]);

      yield* harness.resolve('b', 'gov');
      yield* settle;
      yield* dispatcher.forceFlush;
      expect(sent.map(item => item.payload)).toEqual([1, 3]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('atomically claims pending same-org items before a lookup that overtakes the observer', async () => {
    const program = Effect.gen(function* () {
      const classification = yield* Ref.make<OrgTelemetryClassification>('unknown');
      const { sent, sink } = makeSink();
      const dispatcher = yield* makeGovernedEgressDispatcher(
        {
          getClassification: () => Ref.get(classification),
          changes: Stream.never
        },
        Effect.succeed(sink)
      );

      expect(yield* dispatcher.submit({ orgId: 'org', payload: 1 })).toBe('queued');
      yield* Ref.set(classification, 'nonGov');
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 2 })).toBe('claimed');
      yield* dispatcher.forceFlush;

      expect(sent.map(item => item.payload)).toEqual([1, 2]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('discards pending same-org items when a Gov lookup overtakes the observer', async () => {
    const program = Effect.gen(function* () {
      const classification = yield* Ref.make<OrgTelemetryClassification>('unknown');
      const { sent, sink } = makeSink();
      const dispatcher = yield* makeGovernedEgressDispatcher(
        {
          getClassification: () => Ref.get(classification),
          changes: Stream.never
        },
        Effect.succeed(sink)
      );

      expect(yield* dispatcher.submit({ orgId: 'org', payload: 1 })).toBe('queued');
      yield* Ref.set(classification, 'gov');
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 2 })).toBe('dropped');
      yield* Ref.set(classification, 'nonGov');
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 3 })).toBe('dropped');
      yield* dispatcher.forceFlush;

      expect(sent).toEqual([]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('evicts the global oldest unknown item at capacity', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      const { sent, sink } = makeSink();
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      yield* dispatcher.submit({ orgId: 'oldest', payload: 0 });
      yield* Effect.forEach(
        Array.from({ length: 1000 }, (_, index) => index + 1),
        payload => dispatcher.submit({ orgId: 'kept', payload }),
        { discard: true }
      );

      yield* harness.resolve('oldest', 'nonGov');
      yield* harness.resolve('kept', 'nonGov');
      yield* settle;
      yield* dispatcher.forceFlush;
      expect(sent).toHaveLength(1000);
      expect(sent[0].payload).toBe(1);
      expect(sent[999].payload).toBe(1000);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('contains a send failure and continues later FIFO items', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      const attempted: number[] = [];
      const sink = makeSink(item =>
        Effect.sync(() => attempted.push(item.payload)).pipe(
          Effect.zipRight(item.payload === 1 ? Effect.fail('failed') : Effect.void)
        )
      ).sink;
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      yield* dispatcher.submit({ orgId: 'org', payload: 1 });
      yield* dispatcher.submit({ orgId: 'org', payload: 2 });
      yield* harness.resolve('org', 'nonGov');
      yield* settle;
      yield* dispatcher.forceFlush;
      expect(attempted).toEqual([1, 2]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('serializes separately claimed sends in admission FIFO order', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('org', 'nonGov');
      const firstRelease = yield* Deferred.make<void>();
      const started: number[] = [];
      const sink = makeSink(item =>
        Effect.sync(() => started.push(item.payload)).pipe(
          Effect.zipRight(item.payload === 1 ? Deferred.await(firstRelease) : Effect.void)
        )
      ).sink;
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));

      yield* dispatcher.submit({ orgId: 'org', payload: 1 });
      yield* dispatcher.submit({ orgId: 'org', payload: 2 });
      yield* settle;
      expect(started).toEqual([1]);
      yield* Deferred.succeed(firstRelease, undefined);
      yield* dispatcher.forceFlush;
      expect(started).toEqual([1, 2]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('keeps invocation FIFO when the first concurrent classification lookup is delayed', async () => {
    const program = Effect.gen(function* () {
      const firstLookupStarted = yield* Deferred.make<void>();
      const releaseFirstLookup = yield* Deferred.make<void>();
      const { sent, sink } = makeSink();
      const dispatcher = yield* makeGovernedEgressDispatcher(
        {
          getClassification: orgId =>
            orgId === 'first'
              ? Deferred.succeed(firstLookupStarted, undefined).pipe(
                  Effect.zipRight(Deferred.await(releaseFirstLookup)),
                  Effect.as('nonGov' as const)
                )
              : Effect.succeed('nonGov' as const),
          changes: Stream.never
        },
        Effect.succeed(sink)
      );

      const first = yield* Effect.fork(dispatcher.submit({ orgId: 'first', payload: 1 }));
      yield* Deferred.await(firstLookupStarted);
      const second = yield* Effect.fork(dispatcher.submit({ orgId: 'second', payload: 2 }));
      yield* settle;
      yield* Deferred.succeed(releaseFirstLookup, undefined);
      expect(yield* Fiber.join(first)).toBe('claimed');
      expect(yield* Fiber.join(second)).toBe('claimed');
      yield* dispatcher.forceFlush;

      expect(sent.map(item => item.payload)).toEqual([1, 2]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('publishes concurrent direct and resolved claims in admission order', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('direct', 'nonGov');
      yield* settle;
      const firstRelease = yield* Deferred.make<void>();
      const started: number[] = [];
      const sink = makeSink(item =>
        Effect.sync(() => started.push(item.payload)).pipe(
          Effect.zipRight(item.payload === 1 ? Deferred.await(firstRelease) : Effect.void)
        )
      ).sink;
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));

      expect(yield* dispatcher.submit({ orgId: 'pending', payload: 1 })).toBe('queued');
      expect(yield* dispatcher.submit({ orgId: 'pending', payload: 2 })).toBe('queued');
      yield* harness.resolve('pending', 'nonGov');
      yield* settle;
      const submissions = yield* Effect.all(
        [3, 4, 5].map(payload => dispatcher.submit({ orgId: 'direct', payload })),
        { concurrency: 'unbounded' }
      );
      expect(submissions).toEqual(['claimed', 'claimed', 'claimed']);
      yield* settle;
      expect(started).toEqual([1]);

      yield* Deferred.succeed(firstRelease, undefined);
      yield* dispatcher.forceFlush;
      expect(started).toEqual([1, 2, 3, 4, 5]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('keeps cached Gov when a lagging nonGov observation arrives', async () => {
    const program = Effect.gen(function* () {
      const changes = yield* Queue.unbounded<OrgTelemetryPolicyState>();
      const current = yield* Ref.make<OrgTelemetryClassification>('nonGov');
      const policy = {
        getClassification: () => Ref.get(current),
        changes: Stream.fromQueue(changes)
      };
      const { sent, sink } = makeSink();
      const dispatcher = yield* makeGovernedEgressDispatcher(policy, Effect.succeed(sink));

      yield* Ref.set(current, 'gov');
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 1 })).toBe('dropped');
      yield* Queue.offer(changes, { orgId: 'org', classification: 'nonGov' });
      yield* Queue.offer(changes, { orgId: 'org', classification: 'unknown' });
      yield* settle;
      yield* Ref.set(current, 'nonGov');
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 2 })).toBe('dropped');
      yield* dispatcher.forceFlush;
      expect(sent).toEqual([]);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('caches sink initialization failure for the session', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('org', 'nonGov');
      const make = jest.fn(() => Effect.fail('no sink'));
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.suspend(make));

      yield* dispatcher.submit({ orgId: 'org', payload: 1 });
      yield* dispatcher.submit({ orgId: 'org', payload: 2 });
      yield* dispatcher.forceFlush;
      expect(make).toHaveBeenCalledTimes(1);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('close rejects new items, discards unresolved items, waits claimed sends, and closes once', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('allowed', 'nonGov');
      const release = yield* Deferred.make<void>();
      const closeSink = jest.fn();
      const attempted: number[] = [];
      const sink: GovernedEgressSink<number> = {
        send: item => Effect.sync(() => attempted.push(item.payload)).pipe(Effect.zipRight(Deferred.await(release))),
        forceFlush: Effect.void,
        close: Effect.sync(closeSink)
      };
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      yield* dispatcher.submit({ orgId: 'unresolved', payload: 1 });
      yield* dispatcher.submit({ orgId: 'allowed', payload: 2 });
      const closing = yield* Effect.fork(dispatcher.close);
      yield* settle;

      expect(yield* dispatcher.submit({ orgId: 'allowed', payload: 3 })).toBe('rejected');
      yield* harness.resolve('unresolved', 'nonGov');
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(closing);
      yield* Effect.all([dispatcher.close, dispatcher.close]);
      expect(closeSink).toHaveBeenCalledTimes(1);
      expect(attempted).toEqual([2]);
      expect(yield* dispatcher.submit({ orgId: 'unresolved', payload: 4 })).toBe('rejected');
    });
    await Effect.runPromise(program);
  });

  it('completes close after the winning close caller is interrupted during a resolution race', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      const release = yield* Deferred.make<void>();
      const closeSink = jest.fn();
      const sink: GovernedEgressSink<number> = {
        send: () => Deferred.await(release),
        forceFlush: Effect.void,
        close: Effect.sync(closeSink)
      };
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 1 })).toBe('queued');
      yield* harness.resolve('org', 'nonGov');
      yield* settle;

      const firstClose = yield* Effect.fork(dispatcher.close);
      yield* settle;
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 2 })).toBe('rejected');
      yield* Fiber.interrupt(firstClose);
      const secondClose = yield* Effect.fork(dispatcher.close);
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(secondClose);

      expect(closeSink).toHaveBeenCalledTimes(1);
      expect(yield* dispatcher.submit({ orgId: 'org', payload: 3 })).toBe('rejected');
    });
    await Effect.runPromise(program);
  });

  it('forceFlush waits claimed sends and flushes only an initialized sink', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      const uninitializedMake = jest.fn(() => makeSink().sink);
      const uninitialized = yield* makeGovernedEgressDispatcher(harness.policy, Effect.sync(uninitializedMake));
      yield* uninitialized.forceFlush;
      expect(uninitializedMake).not.toHaveBeenCalled();
      yield* uninitialized.close;

      yield* harness.resolve('org', 'nonGov');
      const release = yield* Deferred.make<void>();
      const flushed = jest.fn();
      const sink: GovernedEgressSink<number> = {
        send: () => Deferred.await(release),
        forceFlush: Effect.sync(flushed),
        close: Effect.void
      };
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      yield* dispatcher.submit({ orgId: 'org', payload: 1 });
      const flushing = yield* Effect.fork(dispatcher.forceFlush);
      yield* settle;
      expect(flushed).not.toHaveBeenCalled();
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(flushing);
      expect(flushed).toHaveBeenCalledTimes(1);
      yield* dispatcher.close;
    });
    await Effect.runPromise(program);
  });

  it('forceFlush racing after close starts awaits close without touching the sink', async () => {
    const program = Effect.gen(function* () {
      const harness = yield* makePolicy();
      yield* harness.resolve('org', 'nonGov');
      const closeStarted = yield* Deferred.make<void>();
      const closeRelease = yield* Deferred.make<void>();
      const flushed = jest.fn();
      const sink: GovernedEgressSink<number> = {
        send: () => Effect.void,
        forceFlush: Effect.sync(flushed),
        close: Deferred.succeed(closeStarted, undefined).pipe(Effect.zipRight(Deferred.await(closeRelease)))
      };
      const dispatcher = yield* makeGovernedEgressDispatcher(harness.policy, Effect.succeed(sink));
      yield* dispatcher.submit({ orgId: 'org', payload: 1 });
      yield* settle;

      const closing = yield* Effect.fork(dispatcher.close);
      yield* Deferred.await(closeStarted);
      const flushing = yield* Effect.fork(dispatcher.forceFlush);
      yield* settle;
      expect(flushed).not.toHaveBeenCalled();
      expect(yield* Fiber.poll(flushing)).toEqual(Option.none());

      yield* Deferred.succeed(closeRelease, undefined);
      yield* Fiber.join(closing);
      yield* Fiber.join(flushing);
      expect(flushed).not.toHaveBeenCalled();
    });
    await Effect.runPromise(program);
  });
});
