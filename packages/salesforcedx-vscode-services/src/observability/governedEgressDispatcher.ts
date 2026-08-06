/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  OrgTelemetryClassification,
  OrgTelemetryPolicyService,
  OrgTelemetryPolicyState
} from './orgTelemetryPolicy';
import * as Cause from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SynchronizedRef from 'effect/SynchronizedRef';

const GOVERNED_EGRESS_PENDING_CAPACITY = 1000;

export type GovernedEgressItem<Payload> = Readonly<{
  orgId: string | undefined;
  payload: Payload;
}>;

export type GovernedEgressSink<Payload> = Readonly<{
  send: (item: GovernedEgressItem<Payload>) => Effect.Effect<void, unknown>;
  forceFlush: Effect.Effect<void, unknown>;
  close: Effect.Effect<void, unknown>;
}>;

export type GovernedEgressDisposition = 'claimed' | 'queued' | 'dropped' | 'rejected';

export type GovernedEgressDispatcher<Payload> = Readonly<{
  submit: (item: GovernedEgressItem<Payload>) => Effect.Effect<GovernedEgressDisposition>;
  forceFlush: Effect.Effect<void>;
  close: Effect.Effect<void>;
}>;

type Lifecycle = 'open' | 'closing' | 'closed';

type DispatcherState<Payload> = Readonly<{
  lifecycle: Lifecycle;
  pending: Chunk.Chunk<GovernedEgressItem<Payload>>;
  classifications: HashMap.HashMap<string, OrgTelemetryClassification>;
  claimed: number;
  idle: Deferred.Deferred<void>;
}>;

type Claim<Payload> = Readonly<{
  items: Chunk.Chunk<GovernedEgressItem<Payload>>;
  ready: Deferred.Deferred<void>;
}>;

type Admission =
  | Readonly<{ disposition: 'claimed'; ready: Deferred.Deferred<void> }>
  | Readonly<{ disposition: Exclude<GovernedEgressDisposition, 'claimed'> }>;

const logFailure = (orgId: string | undefined, disposition: string, count: number, cause: Cause.Cause<unknown>) =>
  Effect.logWarning('Governed telemetry egress operation failed').pipe(
    Effect.annotateLogs({ orgId: orgId ?? 'missing', disposition, count, cause: Cause.pretty(cause) })
  );

export const makeGovernedEgressDispatcher = <Payload>(
  policy: Pick<OrgTelemetryPolicyService, 'getClassification' | 'changes'>,
  makeSink: Effect.Effect<GovernedEgressSink<Payload>, unknown>
) =>
  Effect.gen(function* () {
    const initialIdle = yield* Deferred.make<void>();
    yield* Deferred.succeed(initialIdle, undefined);

    const state = yield* SynchronizedRef.make<DispatcherState<Payload>>({
      lifecycle: 'open',
      pending: Chunk.empty(),
      classifications: HashMap.empty(),
      claimed: 0,
      idle: initialIdle
    });
    const initializedSink = yield* Ref.make<Option.Option<GovernedEgressSink<Payload>>>(Option.none());
    const closeDone = yield* Deferred.make<void>();
    const getSink = yield* Effect.cached(
      makeSink.pipe(Effect.tap(sink => Ref.set(initializedSink, Option.some(sink))))
    );
    const claims = yield* Queue.unbounded<Claim<Payload>>();
    const admissionGate = yield* Effect.makeSemaphore(1);

    const finishClaim = SynchronizedRef.modifyEffect(state, current =>
      current.claimed === 1
        ? Deferred.succeed(current.idle, undefined).pipe(Effect.as([undefined, { ...current, claimed: 0 }] as const))
        : Effect.succeed([undefined, { ...current, claimed: current.claimed - 1 }] as const)
    );

    const sendItems = ({ items, ready }: Claim<Payload>) =>
      Effect.gen(function* () {
        yield* Deferred.await(ready);
        const sink = yield* getSink;
        yield* Effect.forEach(
          items,
          item => sink.send(item).pipe(Effect.catchAllCause(cause => logFailure(item.orgId, 'send', 1, cause))),
          { concurrency: 1, discard: true }
        );
      }).pipe(
        Effect.catchAllCause(cause =>
          logFailure(
            Chunk.get(items, 0).pipe(
              Option.flatMapNullable(item => item.orgId),
              Option.getOrUndefined
            ),
            'initialize',
            Chunk.size(items),
            cause
          )
        ),
        Effect.ensuring(finishClaim)
      );

    const worker = yield* Stream.fromQueue(claims).pipe(Stream.runForEach(sendItems), Effect.forkDaemon);

    const claimAndPublish = (current: DispatcherState<Payload>, items: Chunk.Chunk<GovernedEgressItem<Payload>>) =>
      Effect.gen(function* () {
        const idle = current.claimed === 0 ? yield* Deferred.make<void>() : current.idle;
        const ready = yield* Deferred.make<void>();
        yield* Queue.offer(claims, { items, ready });
        return [
          { disposition: 'claimed' as const, ready },
          { ...current, claimed: current.claimed + 1, idle }
        ] as const;
      });

    const mergeClassification = (
      cached: Option.Option<OrgTelemetryClassification>,
      current: OrgTelemetryClassification
    ): OrgTelemetryClassification => (current === 'gov' || Option.contains(cached, 'gov') ? 'gov' : current);

    const admit = (item: GovernedEgressItem<Payload>, lookup: OrgTelemetryClassification) =>
      SynchronizedRef.modifyEffect<DispatcherState<Payload>, Admission, never, never>(state, current => {
        if (current.lifecycle !== 'open') {
          return Effect.succeed([{ disposition: 'rejected' as const }, current] as const);
        }
        if (!item.orgId) {
          return Effect.succeed([{ disposition: 'dropped' as const }, current] as const);
        }

        const classification = mergeClassification(HashMap.get(current.classifications, item.orgId), lookup);
        const classifications = HashMap.set(current.classifications, item.orgId, classification);
        if (classification === 'gov') {
          const retainedPending = Chunk.filter(current.pending, pendingItem => pendingItem.orgId !== item.orgId);
          return Effect.succeed([
            { disposition: 'dropped' as const },
            { ...current, classifications, pending: retainedPending }
          ] as const);
        }
        if (classification === 'unknown') {
          const appended = Chunk.append(current.pending, item);
          const pending = Chunk.size(appended) > GOVERNED_EGRESS_PENDING_CAPACITY ? Chunk.drop(appended, 1) : appended;
          return Effect.succeed([
            { disposition: 'queued' as const },
            { ...current, classifications, pending }
          ] as const);
        }

        const existing = Chunk.filter(current.pending, pendingItem => pendingItem.orgId === item.orgId);
        const remainingPending = Chunk.filter(current.pending, pendingItem => pendingItem.orgId !== item.orgId);
        return claimAndPublish(
          { ...current, classifications, pending: remainingPending },
          Chunk.append(existing, item)
        );
      });

    const submit = (submitted: GovernedEgressItem<Payload>) => {
      const item: GovernedEgressItem<Payload> = Object.freeze({
        orgId: submitted.orgId,
        payload: submitted.payload
      });
      const classification = item.orgId
        ? policy
            .getClassification(item.orgId)
            .pipe(Effect.catchAll(() => Effect.succeed<OrgTelemetryClassification>('unknown')))
        : Effect.succeed<OrgTelemetryClassification>('unknown');
      return Effect.gen(function* () {
        const value = yield* classification;
        return yield* admit(item, value).pipe(
          Effect.tap(admission =>
            admission.disposition === 'claimed' ? Deferred.succeed(admission.ready, undefined) : Effect.void
          ),
          Effect.map(admission => admission.disposition),
          Effect.uninterruptible
        );
      }).pipe(admissionGate.withPermits(1));
    };

    const resolve = ({ orgId, classification }: OrgTelemetryPolicyState) =>
      orgId
        ? SynchronizedRef.modifyEffect<DispatcherState<Payload>, Admission | undefined, never, never>(
            state,
            current => {
              if (current.lifecycle !== 'open') {
                return Effect.succeed([undefined, current] as const);
              }

              const merged = mergeClassification(HashMap.get(current.classifications, orgId), classification);
              const classifications = HashMap.set(current.classifications, orgId, merged);
              if (merged === 'unknown') {
                return Effect.succeed([undefined, { ...current, classifications }] as const);
              }

              const items = Chunk.filter(current.pending, item => item.orgId === orgId);
              const pending = Chunk.filter(current.pending, item => item.orgId !== orgId);
              const next = { ...current, classifications, pending };
              return merged === 'nonGov' && Chunk.isNonEmpty(items)
                ? claimAndPublish(next, items)
                : Effect.succeed([undefined, next] as const);
            }
          ).pipe(
            Effect.tap(admission =>
              admission?.disposition === 'claimed' ? Deferred.succeed(admission.ready, undefined) : Effect.void
            ),
            Effect.asVoid,
            Effect.uninterruptible,
            admissionGate.withPermits(1)
          )
        : Effect.void;

    const observer = yield* policy.changes.pipe(
      Stream.runForEach(resolve),
      Effect.catchAllCause(cause => logFailure(undefined, 'policy-stream', 0, cause)),
      Effect.forkDaemon
    );

    const awaitClaims = SynchronizedRef.get(state).pipe(Effect.flatMap(current => Deferred.await(current.idle)));
    const flushOpenDispatcher = awaitClaims.pipe(
      Effect.zipRight(Ref.get(initializedSink)),
      Effect.flatMap(Option.match({ onNone: () => Effect.void, onSome: sink => sink.forceFlush }))
    );
    const forceFlush = SynchronizedRef.get(state).pipe(
      Effect.flatMap(current => (current.lifecycle === 'open' ? flushOpenDispatcher : Deferred.await(closeDone))),
      Effect.catchAllCause(cause => logFailure(undefined, 'forceFlush', 0, cause)),
      admissionGate.withPermits(1)
    );

    const finishClose = SynchronizedRef.update(state, current => ({ ...current, lifecycle: 'closed' as const })).pipe(
      Effect.zipRight(Deferred.succeed(closeDone, undefined)),
      Effect.asVoid
    );
    const runClose = Effect.gen(function* () {
      yield* Fiber.interrupt(observer);
      yield* awaitClaims;
      yield* Fiber.interrupt(worker);
      const sink = yield* Ref.get(initializedSink);
      yield* Option.match(sink, { onNone: () => Effect.void, onSome: value => value.close });
    }).pipe(
      Effect.catchAllCause(cause => logFailure(undefined, 'close', 0, cause)),
      Effect.ensuring(finishClose)
    );
    const beginClose = SynchronizedRef.modify(state, current =>
      current.lifecycle === 'open'
        ? [true, { ...current, lifecycle: 'closing' as const, pending: Chunk.empty() }]
        : [false, current]
    ).pipe(
      Effect.flatMap(winner => (winner ? Effect.forkDaemon(runClose) : Effect.void)),
      Effect.uninterruptible,
      admissionGate.withPermits(1)
    );
    const close = beginClose.pipe(Effect.zipRight(Deferred.await(closeDone)));

    return { submit, forceFlush, close };
  });
