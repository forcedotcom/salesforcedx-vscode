/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import {
  AliasService,
  ConfigService,
  ConnectionService,
  DefaultOrgInfoSchema,
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError,
  TargetOrgRef
} from '@salesforce/vscode-services-v2';
import type { CompatibilityHost, HostExit, HostReason } from '@salesforce/vscode-services-v3-compat/host';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import { identity } from 'effect/Function';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export {
  createLegacyServices,
  DefaultOrgInfoSchema as V3DefaultOrgInfoSchema
} from '@salesforce/vscode-services-v3-compat';
export type { Connection } from '@salesforce/core';
export { Effect as V4Effect, Deferred as V4Deferred, Duration as V4Duration, Cause as V4Cause, Fiber as V4Fiber };
export { NoTargetOrgConfiguredError };
export {
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoWorkspaceOpenError,
  SettingsError
};

const ConfigErrors = Schema.Union([NoWorkspaceOpenError, FailedToCreateConfigAggregatorError]);
const ConnectionErrors = Schema.Union([
  SettingsError,
  NoWorkspaceOpenError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateAuthInfoError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  AccessTokenExpiredError
]);
const encodeFailureReason = <E, D>(error: E, encode: (error: E) => D): HostReason<D> => {
  try {
    return { _tag: 'Fail', error: encode(error) };
  } catch (defect) {
    return { _tag: 'Die', defect };
  }
};

const encodeExit = <A, E, D>(exit: Exit.Exit<A, E>, encode: (error: E) => D): HostExit<A, D> =>
  exit._tag === 'Success'
    ? { _tag: 'Success', value: exit.value }
    : {
        _tag: 'Failure',
        reasons: exit.cause.reasons.map((reason): HostReason<D> => {
          switch (reason._tag) {
            case 'Fail':
              return encodeFailureReason(reason.error, encode);
            case 'Die':
              return { _tag: 'Die', defect: reason.defect };
            case 'Interrupt':
              return { _tag: 'Interrupt', fiberId: reason.fiberId };
          }
        })
      };

type OrgCallback = Parameters<CompatibilityHost['subscribeOrgChanges']>[0];
type ConnectionBehavior = ConnectionService['Service']['getConnection'];
type Stats = { readonly graphBuilds: number; readonly graphDisposals: number; readonly connectionCalls: number };

/** Test implementation only: one acquired V4 graph, with cancellation-safe acknowledged org commits. */
export const makeV4Host = async (
  connection?: Connection,
  testControl?: { readonly unsafeInterruptibleCommits: boolean }
) => {
  const stats = Effect.runSync(Ref.make<Stats>({ graphBuilds: 0, graphDisposals: 0, connectionCalls: 0 }));
  const callbacks = Effect.runSync(Ref.make<readonly OrgCallback[]>([]));
  const permit = Effect.runSync(Semaphore.make(1));
  const orgRef = Effect.runSync(
    SubscriptionRef.make(Schema.decodeUnknownSync(DefaultOrgInfoSchema)({ orgId: '00D000000000001' }))
  );
  const behavior = Effect.runSync(
    Ref.make<ConnectionBehavior>(() =>
      connection
        ? Effect.succeed(connection)
        : Effect.fail(new NoTargetOrgConfiguredError({ message: 'No target org configured' }))
    )
  );

  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      Layer.unwrap(
        Effect.gen(function* () {
          yield* Ref.update(stats, current => ({ ...current, graphBuilds: current.graphBuilds + 1 }));
          yield* Effect.addFinalizer(() =>
            Ref.update(stats, current => ({ ...current, graphDisposals: current.graphDisposals + 1 }))
          );
          return Layer.mock(ConnectionService, {
            getConnection: Effect.fn('FixtureConnection.getConnection')(function* (username?: string) {
              yield* Ref.update(stats, current => ({ ...current, connectionCalls: current.connectionCalls + 1 }));
              return yield* Ref.get(behavior).pipe(Effect.flatMap(getConnection => getConnection(username)));
            })
          });
        })
      ),
      // This host exercises the frozen bridge methods; unrelated V4 methods remain unimplemented.
      Layer.mock(AliasService, { getAliasesFromUsername: username => Effect.succeed([`${username}-alias`]) }),
      Layer.mock(ConfigService, { getTargetOrg: () => Effect.succeed('configured-alias') }),
      Layer.succeed(TargetOrgRef, orgRef)
    )
  );
  await runtime.runPromise(Effect.void);

  const run = <A, E, D>(
    program: Effect.Effect<A, E, ConnectionService | AliasService | ConfigService | TargetOrgRef>,
    encode: (error: E) => D,
    signal?: AbortSignal
  ): Promise<HostExit<A, D>> =>
    signal?.aborted
      ? Promise.resolve({ _tag: 'Failure', reasons: [{ _tag: 'Interrupt', fiberId: undefined }] })
      : runtime.runPromiseExit(program, { signal }).then(exit => encodeExit(exit, encode));

  const removeCallback = (callback: OrgCallback) =>
    Ref.update(callbacks, current => current.filter(value => value !== callback));
  const host: CompatibilityHost = {
    getConnection: (username, signal) =>
      run(
        ConnectionService.use(service => service.getConnection(username)),
        Schema.encodeSync(ConnectionErrors),
        signal
      ),
    getAliasesFromUsername: (username, signal) =>
      run(
        AliasService.use(service => service.getAliasesFromUsername(username)),
        identity<never>,
        signal
      ),
    getTargetOrg: signal =>
      run(
        ConfigService.use(service => service.getTargetOrg()),
        Schema.encodeSync(ConfigErrors),
        signal
      ),
    subscribeOrgChanges: callback =>
      run(
        permit.withPermit(
          Effect.uninterruptible(
            Effect.gen(function* () {
              yield* Ref.update(callbacks, current => [...current, callback]);
              yield* SubscriptionRef.get(orgRef).pipe(
                Effect.flatMap(snapshot => Effect.promise(() => callback(snapshot))),
                Effect.onError(() => removeCallback(callback))
              );
              return () => run(permit.withPermit(Effect.uninterruptible(removeCallback(callback))), identity<never>);
            })
          )
        ),
        identity<never>
      ),
    redact: text => text.replaceAll('Bearer fixture-secret', '<REDACTED BEARER TOKEN>')
  };

  const commitOrg = Effect.fn('FixtureHost.commitOrg')(function* (snapshot: typeof DefaultOrgInfoSchema.Type) {
    yield* SubscriptionRef.set(orgRef, snapshot);
    yield* Ref.get(callbacks).pipe(
      Effect.flatMap(values => Effect.forEach(values, callback => Effect.promise(() => callback(snapshot))))
    );
  });

  return {
    host,
    runtime,
    run: <A>(
      program: Effect.Effect<A, never, ConnectionService | AliasService | ConfigService | TargetOrgRef>,
      signal?: AbortSignal
    ) => run(program, identity<never>, signal),
    setConnectionBehavior: (next: ConnectionBehavior) => runtime.runPromise(Ref.set(behavior, next)),
    directConnection: (username?: string) =>
      runtime.runPromise(ConnectionService.use(service => service.getConnection(username))),
    readOrg: () => runtime.runPromise(SubscriptionRef.get(orgRef)),
    commitOrg: (snapshot: typeof DefaultOrgInfoSchema.Encoded, signal?: AbortSignal) =>
      run(
        Schema.decodeUnknownEffect(DefaultOrgInfoSchema)(snapshot).pipe(
          Effect.orDie,
          Effect.flatMap(org =>
            permit.withPermit(
              testControl?.unsafeInterruptibleCommits ? commitOrg(org) : Effect.uninterruptible(commitOrg(org))
            )
          )
        ),
        identity<never>,
        signal
      ),
    stats: () => Effect.runSync(Ref.get(stats)),
    subscriberCount: () => Effect.runSync(Ref.get(callbacks)).length,
    dispose: () => runtime.dispose()
  };
};
