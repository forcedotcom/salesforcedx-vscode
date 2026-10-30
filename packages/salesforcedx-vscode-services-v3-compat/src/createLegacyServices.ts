/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { CompatibilityHost, HostExit, HostReason } from './compatibilityHost.js';
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as FiberId from 'effect/FiberId';
import { identity } from 'effect/Function';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as Match from 'effect/Match';
import { isUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { DefaultOrgInfoSchema, type DefaultOrgInfo } from './defaultOrgInfo.js';
import { ConfigFailureSchema, ConnectionFailureSchema } from './serviceErrors.js';
import { AliasService, ConfigService, ConnectionService } from './services.js';

const failureCause = <D, E>(error: D, decode: (data: D) => E): Cause.Cause<E> => {
  try {
    return Cause.fail(decode(error));
  } catch (defect) {
    // Invalid host data is a defect, but must not discard later mixed Cause reasons.
    return Cause.die(defect);
  }
};

const hostCause = <D, E>(reasons: readonly HostReason<D>[], decode: (data: D) => E) =>
  reasons.reduce<Cause.Cause<E>>(
    (cause, reason) =>
      Cause.sequential(
        cause,
        Match.value(reason).pipe(
          Match.tag('Fail', ({ error }) => failureCause(error, decode)),
          Match.tag('Die', ({ defect }) => Cause.die(defect)),
          // V4 has no V3 runtime timestamp. Zero explicitly denotes a synthetic foreign-fiber ID.
          Match.tag('Interrupt', ({ fiberId }) =>
            Cause.interrupt(isUndefined(fiberId) ? FiberId.none : FiberId.runtime(fiberId, 0))
          ),
          Match.exhaustive
        )
      ),
    Cause.empty
  );

export const fromHostExit = <A, D, E>(exit: HostExit<A, D>, decode: (data: D) => E) =>
  exit._tag === 'Success' ? Effect.succeed(exit.value) : Effect.failCause(hostCause(exit.reasons, decode));

const completeHost = <A, D>(run: () => Promise<HostExit<A, D>>) => {
  const defectExit = (defect: unknown): HostExit<A, D> => ({ _tag: 'Failure', reasons: [{ _tag: 'Die', defect }] });
  try {
    return run().catch(defectExit);
  } catch (defect) {
    // Capture the foreign callback before V3's synchronous-exception tracer can replace its identity.
    return Promise.resolve(defectExit(defect));
  }
};

const startHost = <A, D>(run: (signal: AbortSignal) => Promise<HostExit<A, D>>, signal: AbortSignal) =>
  signal.aborted
    ? Promise.resolve<HostExit<A, D>>({ _tag: 'Failure', reasons: [{ _tag: 'Interrupt', fiberId: undefined }] })
    : completeHost(() => run(signal));

type Operation = { readonly controller: AbortController; readonly finished: Deferred.Deferred<void> };
type BridgeState = { readonly closed: boolean; readonly operations: readonly Operation[] };

const makeLegacyServices = Effect.fn('V3Compatibility.makeLegacyServices')(function* (host: CompatibilityHost) {
  const state = yield* Ref.make<BridgeState>({ closed: false, operations: [] });
  const orgRef = yield* SubscriptionRef.make<DefaultOrgInfo>({});

  const fromHost = <A, D, E>(run: (signal: AbortSignal) => Promise<HostExit<A, D>>, decode: (data: D) => E) =>
    Effect.uninterruptibleMask(restore =>
      Effect.Do.pipe(
        // AbortSignal is the external Promise protocol; no foreign Effect/Fiber is exposed to V3.
        Effect.bind('controller', () => Effect.sync(() => new AbortController())),
        Effect.bind('finished', () => Deferred.make<void>()),
        Effect.bind('registered', ({ controller, finished }) =>
          Ref.modify(state, current =>
            current.closed
              ? ([false, current] as const)
              : ([true, { ...current, operations: [...current.operations, { controller, finished }] }] as const)
          )
        ),
        Effect.flatMap(({ controller, finished, registered }) =>
          registered
            ? Effect.sync(() => startHost(run, controller.signal)).pipe(
                Effect.flatMap(completion =>
                  restore(
                    Effect.async<HostExit<A, D>>(resume => {
                      completion.then(
                        exit => resume(Effect.succeed(exit)),
                        defect => resume(Effect.die(defect))
                      );
                      return Effect.sync(() => controller.abort());
                    })
                  ).pipe(
                    Effect.exit,
                    Effect.flatMap(waitExit => {
                      if (Exit.isSuccess(waitExit)) return fromHostExit(waitExit.value, decode);
                      if (!Cause.isInterrupted(waitExit.cause)) return Effect.failCause(waitExit.cause);
                      // The outer mask waits for V4 finalizers after V3 cancellation, retaining all failures.
                      return Effect.sync(() => controller.abort()).pipe(
                        Effect.zipRight(Effect.promise(() => completion).pipe(Effect.exit)),
                        Effect.flatMap(hostExit => {
                          if (Exit.isFailure(hostExit))
                            return Effect.failCause(Cause.sequential(waitExit.cause, hostExit.cause));
                          if (hostExit.value._tag === 'Failure') {
                            return Effect.failCause(
                              Cause.sequential(waitExit.cause, hostCause(hostExit.value.reasons, decode))
                            );
                          }
                          return Effect.failCause(waitExit.cause);
                        })
                      );
                    })
                  )
                ),
                Effect.ensuring(
                  Ref.update(state, current => ({
                    ...current,
                    operations: current.operations.filter(operation => operation.controller !== controller)
                  })).pipe(Effect.zipRight(Deferred.succeed(finished, undefined)))
                )
              )
            : Effect.interrupt
        )
      )
    );

  const getConnection = Effect.fn('V3Compatibility.getConnection')(function* (username?: string) {
    return yield* fromHost(
      signal => host.getConnection(username, signal),
      Schema.decodeUnknownSync(ConnectionFailureSchema)
    );
  });
  const getAliasesFromUsername = Effect.fn('V3Compatibility.getAliasesFromUsername')(function* (username: string) {
    return yield* fromHost(signal => host.getAliasesFromUsername(username, signal), identity<never>);
  });
  const getTargetOrg = Effect.fn('V3Compatibility.getTargetOrg')(function* () {
    return yield* fromHost(signal => host.getTargetOrg(signal), Schema.decodeUnknownSync(ConfigFailureSchema));
  });
  const TargetOrgRef = Effect.fn('V3Compatibility.TargetOrgRef')(function* () {
    return yield* Ref.get(state).pipe(
      Effect.flatMap(current => (current.closed ? Effect.interrupt : Effect.succeed(orgRef)))
    );
  });

  // Acquisition stays masked until the stop handle is registered, including startup cancellation.
  yield* Effect.acquireRelease(
    Effect.promise(() =>
      completeHost(() =>
        host.subscribeOrgChanges(snapshot =>
          Schema.decodeUnknown(DefaultOrgInfoSchema)(snapshot).pipe(
            Effect.flatMap(org =>
              Ref.get(state).pipe(
                Effect.flatMap(current => (current.closed ? Effect.void : SubscriptionRef.set(orgRef, org)))
              )
            ),
            Effect.orDie,
            // This separate V3 runner cannot inherit V4's masked commit acknowledgment.
            Effect.uninterruptible,
            Effect.runPromise
          )
        )
      )
    ).pipe(Effect.flatMap(exit => fromHostExit(exit, identity<never>))),
    stop =>
      Ref.modify(state, current => [current.operations, { ...current, closed: true }] as const).pipe(
        Effect.flatMap(operations =>
          Effect.forEach(operations, ({ controller }) => Effect.sync(() => controller.abort()), { discard: true }).pipe(
            Effect.zipRight(Effect.forEach(operations, ({ finished }) => Deferred.await(finished), { discard: true }))
          )
        ),
        Effect.ensuring(
          Effect.promise(() => completeHost(stop)).pipe(Effect.flatMap(exit => fromHostExit(exit, identity<never>)))
        )
      )
  );

  const context = Context.make(ConnectionService, ConnectionService.of({ getConnection })).pipe(
    Context.add(AliasService, AliasService.of({ getAliasesFromUsername })),
    Context.add(ConfigService, ConfigService.of({ getTargetOrg }))
  );
  return {
    ConnectionService,
    AliasService,
    ConfigService,
    TargetOrgRef,
    prebuiltServicesDependencies: context,
    prebuiltServicesLayer: Layer.succeedContext(context).pipe(
      Layer.merge(
        Logger.replace(Logger.defaultLogger, Logger.stringLogger.pipe(Logger.map(host.redact), Logger.withConsoleLog))
      )
    )
  };
});

/** Imperative ownership boundary: close this V3 scope before disposing the owning V4 runtime. */
export const createLegacyServices = (host: CompatibilityHost, signal?: AbortSignal) =>
  (signal?.aborted
    ? Effect.interrupt
    : Effect.uninterruptibleMask(restore =>
        Effect.gen(function* () {
          const scope = yield* Scope.make();
          // All concurrent/repeated disposals await the same completion, including finalizer defects.
          const close = yield* Effect.cached(Scope.close(scope, Exit.void));
          return yield* makeLegacyServices(host).pipe(
            Scope.extend(scope),
            restore,
            Effect.onExit(exit => (Exit.isFailure(exit) ? close : Effect.void)),
            Effect.map(services => ({ services, dispose: () => Effect.runPromise(close) }))
          );
        })
      )
  ).pipe(effect => Effect.runPromise(effect, { signal }));
