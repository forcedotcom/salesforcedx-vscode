/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { CompatibilityHost } from './compatibilityHost.js';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { identity } from 'effect/Function';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { DefaultOrgInfoSchema, type DefaultOrgInfo } from './defaultOrgInfo.js';
import { completeHost, fromHostExit, makeLegacyHostOperations } from './legacyHostOperations.js';
import { ConfigFailureSchema, ConnectionFailureSchema } from './serviceErrors.js';
import { AliasService, ConfigService, ConnectionService } from './services.js';

const makeLegacyServices = Effect.fn('V3Compatibility.makeLegacyServices')(function* (host: CompatibilityHost) {
  const operations = yield* makeLegacyHostOperations();
  const fromHost = operations.run;
  const orgRef = yield* SubscriptionRef.make<DefaultOrgInfo>({});

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
    return yield* operations.isClosed.pipe(
      Effect.flatMap(closed => (closed ? Effect.interrupt : Effect.succeed(orgRef)))
    );
  });

  // Acquisition stays masked until the stop handle is registered, including startup cancellation.
  yield* Effect.acquireRelease(
    Effect.promise(() =>
      completeHost(() =>
        host.subscribeOrgChanges(snapshot =>
          Schema.decodeUnknown(DefaultOrgInfoSchema)(snapshot).pipe(
            Effect.flatMap(org =>
              operations.isClosed.pipe(
                Effect.flatMap(closed => (closed ? Effect.void : SubscriptionRef.set(orgRef, org)))
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
      operations.close.pipe(
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
