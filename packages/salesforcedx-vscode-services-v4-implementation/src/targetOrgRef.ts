/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  DefaultOrgInfoSchema,
  InactiveOrgOperationError,
  TargetOrgRef,
  type DefaultOrgInfo
} from '@salesforce/vscode-services-v2';
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import * as SubscriptionRef from 'effect/SubscriptionRef';

/** One carrier per graph; connection/org coordination composes this same layer in W-24615059. */
const TargetOrgRefLayer = Layer.effect(
  TargetOrgRef,
  Effect.acquireRelease(SubscriptionRef.make<DefaultOrgInfo>({}), ref => PubSub.shutdown(ref.pubsub))
);

type OrgSnapshot = {
  /** Auth-selection attempts, including same-org connection reads. */
  readonly generation: number;
  /** Committed org/user identity changes, independent of connection/cache reads. */
  readonly orgGeneration: number;
  readonly aliasesRevision: number;
  readonly org: DefaultOrgInfo;
};
type OrgCallback = (snapshot: typeof DefaultOrgInfoSchema.Encoded) => Promise<void>;
const preserveTelemetry = (current: DefaultOrgInfo): DefaultOrgInfo => ({
  ...(current.webUserId ? { webUserId: current.webUserId } : {}),
  ...(current.cliId ? { cliId: current.cliId } : {})
});

/** The only authoritative org writer; callbacks acknowledge commits before the permit is released. */
export class OrgChanges extends Context.Service<
  OrgChanges,
  {
    readonly begin: Effect.Effect<number>;
    readonly snapshot: Effect.Effect<OrgSnapshot>;
    readonly update: (
      generation: number,
      change: (snapshot: OrgSnapshot) => Effect.Effect<DefaultOrgInfo>
    ) => Effect.Effect<boolean>;
    readonly clear: Effect.Effect<void>;
    readonly clearIfCurrent: (generation: number) => Effect.Effect<void>;
    readonly commitIfCurrent: <A, E, R>(
      orgGeneration: number,
      changedError: InactiveOrgOperationError,
      commit: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | InactiveOrgOperationError, R>;
    readonly subscribe: (callback: OrgCallback) => Effect.Effect<{ readonly stop: Effect.Effect<void> }>;
  }
>()('@salesforce/vscode-services-v4-implementation/OrgChanges') {}

export const OrgChangesLayer = Layer.effect(
  OrgChanges,
  Effect.gen(function* () {
    const orgRef = yield* TargetOrgRef;
    const permit = yield* Semaphore.make(1);
    const state = yield* Ref.make({ generation: 0, orgGeneration: 0, aliasesRevision: 0, closed: false });
    const callbacks = yield* Ref.make<readonly OrgCallback[]>([]);
    const snapshot = Effect.gen(function* () {
      const current = yield* Ref.get(state);
      if (current.closed) return yield* Effect.interrupt;
      return {
        generation: current.generation,
        orgGeneration: current.orgGeneration,
        aliasesRevision: current.aliasesRevision,
        org: yield* SubscriptionRef.get(orgRef)
      };
    });
    const publish = Effect.fn('OrgChanges.publish')(function* (
      next: DefaultOrgInfo,
      reason: 'update' | 'clear' = 'update'
    ) {
      const current = yield* SubscriptionRef.get(orgRef);
      // SOQL can return canonical username casing different from AuthInfo; that is not another user.
      if (
        reason === 'clear' ||
        current.orgId !== next.orgId ||
        current.username?.toLowerCase() !== next.username?.toLowerCase()
      ) {
        yield* Ref.update(state, value => ({ ...value, orgGeneration: value.orgGeneration + 1 }));
      }
      if (current.aliases !== next.aliases || current.alias !== next.alias) {
        yield* Ref.update(state, value => ({ ...value, aliasesRevision: value.aliasesRevision + 1 }));
      }
      if (!Schema.toEquivalence(DefaultOrgInfoSchema)(current, next)) yield* SubscriptionRef.set(orgRef, next);
      // Equal commits repair local-only writes to V3 mirrors without republishing V4 changes.
      const exits = yield* Ref.get(callbacks).pipe(
        Effect.flatMap(values =>
          Effect.forEach(values, callback =>
            Effect.promise(() => callback(Schema.encodeSync(DefaultOrgInfoSchema)(next))).pipe(Effect.exit)
          )
        )
      );
      const cause = Cause.fromReasons(exits.flatMap(exit => (Exit.isFailure(exit) ? exit.cause.reasons : [])));
      if (cause.reasons.length > 0) return yield* Effect.failCause(cause);
    });
    const update = Effect.fn('OrgChanges.update')(
      (generation: number, change: (snapshot: OrgSnapshot) => Effect.Effect<DefaultOrgInfo>) =>
        permit.withPermit(
          Effect.uninterruptible(
            Effect.gen(function* () {
              const current = yield* snapshot;
              if (current.generation !== generation) return false;
              yield* change(current).pipe(Effect.flatMap(publish));
              return true;
            })
          )
        )
    );
    const clearIfCurrent = Effect.fn('OrgChanges.clearIfCurrent')((generation: number) =>
      permit.withPermit(
        Effect.uninterruptible(
          Effect.gen(function* () {
            const current = yield* snapshot;
            if (current.generation !== generation) return;
            yield* Ref.update(state, value => ({ ...value, generation: value.generation + 1 }));
            yield* publish(preserveTelemetry(current.org), 'clear');
          })
        )
      )
    );
    const begin = permit.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          yield* snapshot;
          return yield* Ref.modify(
            state,
            current => [current.generation + 1, { ...current, generation: current.generation + 1 }] as const
          );
        })
      )
    );
    const remove = (callback: OrgCallback) =>
      Ref.update(callbacks, values => values.filter(value => value !== callback));
    /** Commit must be bounded and must not reacquire OrgChanges or call network/SDK polling. */
    const commitIfCurrent = <A, E, R>(
      orgGeneration: number,
      changedError: InactiveOrgOperationError,
      commit: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E | InactiveOrgOperationError, R> =>
      snapshot.pipe(
        Effect.flatMap(
          (current): Effect.Effect<A, E | InactiveOrgOperationError, R> =>
            current.orgGeneration === orgGeneration && current.org.orgId === changedError.expectedOrgId
              ? commit
              : Effect.fail(
                  new InactiveOrgOperationError({
                    message: changedError.message,
                    expectedOrgId: changedError.expectedOrgId,
                    ...(current.org.orgId ? { observedOrgId: current.org.orgId } : {})
                  })
                )
        ),
        Effect.uninterruptible,
        program => permit.withPermit(program),
        Effect.withSpan('OrgChanges.commitIfCurrent')
      );
    yield* Effect.addFinalizer(() =>
      permit.withPermit(
        Effect.uninterruptible(
          Ref.update(state, value => ({ ...value, closed: true })).pipe(Effect.andThen(Ref.set(callbacks, [])))
        )
      )
    );
    return OrgChanges.of({
      begin,
      snapshot: permit.withPermit(snapshot),
      update,
      clearIfCurrent,
      commitIfCurrent,
      clear: permit.withPermit(
        Effect.uninterruptible(
          Effect.gen(function* () {
            const current = yield* snapshot;
            yield* Ref.update(state, value => ({ ...value, generation: value.generation + 1 }));
            yield* publish(preserveTelemetry(current.org), 'clear');
          })
        )
      ),
      subscribe: Effect.fn('OrgChanges.subscribe')((callback: OrgCallback) =>
        permit.withPermit(
          Effect.uninterruptible(
            Effect.gen(function* () {
              const current = yield* snapshot;
              yield* Ref.update(callbacks, values => [...values, callback]);
              yield* Effect.promise(() => callback(Schema.encodeSync(DefaultOrgInfoSchema)(current.org))).pipe(
                Effect.onError(() => remove(callback))
              );
              return { stop: permit.withPermit(Effect.uninterruptible(remove(callback))) };
            })
          )
        )
      )
    });
  })
);

/** Stable identity shared by Config, Connection, watchers and the compatibility host. */
export const orgLayers = OrgChangesLayer.pipe(Layer.provideMerge(TargetOrgRefLayer));
