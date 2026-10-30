/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  AccessTokenExpiredError,
  AliasService,
  ConfigService,
  ConnectionService,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError,
  TargetOrgRef
} from '@salesforce/vscode-services-v2';
import type { CompatibilityHost, HostExit, HostReason } from '@salesforce/vscode-services-v3-compat/host';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { identity } from 'effect/Function';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';

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
const encodeReason = <E, D>(
  reason: Exit.Failure<never, E>['cause']['reasons'][number],
  encode: (error: E) => D
): HostReason<D> => {
  if (reason._tag === 'Die') return { _tag: 'Die', defect: reason.defect };
  if (reason._tag === 'Interrupt') return { _tag: 'Interrupt', fiberId: reason.fiberId };
  try {
    return { _tag: 'Fail', error: encode(reason.error) };
  } catch (defect) {
    return { _tag: 'Die', defect };
  }
};
const encodeExit = <A, E, D>(exit: Exit.Exit<A, E>, encode: (error: E) => D): HostExit<A, D> =>
  Exit.isSuccess(exit)
    ? { _tag: 'Success', value: exit.value }
    : { _tag: 'Failure', reasons: exit.cause.reasons.map(reason => encodeReason(reason, encode)) };
type ConnectionGraph = ConnectionService | ConfigService | AliasService | TargetOrgRef | OrgChanges;

/** Imperative owner of one acquired graph. The caller initializes V3 before publishing either API. */
export const createConnectionRuntime = async <R>(
  layer: Layer.Layer<ConnectionGraph | R>,
  redact: CompatibilityHost['redact'],
  signal?: AbortSignal
) => {
  const logging = Logger.layer([Logger.formatSimple.pipe(Logger.map(redact), Logger.withConsoleLog)]);
  const runtime = ManagedRuntime.make(
    layer.pipe(Layer.provideMerge(ServiceOperationsLayer), Layer.provideMerge(logging))
  );
  try {
    if (signal?.aborted) return await Effect.runPromise(Effect.interrupt);
    const [connection, config, alias, orgRef, orgChanges, operations] = await runtime.runPromise(
      Effect.all([ConnectionService, ConfigService, AliasService, TargetOrgRef, OrgChanges, ServiceOperations]),
      { signal }
    );
    // Cache the entire outcome; ManagedRuntime's repeated disposal alone does not replay its first defect.
    const dispose = operations.close.pipe(
      Effect.ensuring(runtime.disposeEffect),
      Effect.exit,
      Effect.cached,
      Effect.runSync
    );
    const run = <A, E, D>(
      program: Effect.Effect<A, E, ConnectionGraph>,
      encode: (error: E) => D,
      input?: AbortSignal
    ): Promise<HostExit<A, D>> =>
      input?.aborted
        ? Promise.resolve({ _tag: 'Failure', reasons: [{ _tag: 'Interrupt', fiberId: undefined }] })
        : runtime.runPromiseExit(operations.run(program), { signal: input }).then(exit => encodeExit(exit, encode));
    const context = Context.make(ConnectionService, connection).pipe(
      Context.add(ConfigService, config),
      Context.add(AliasService, alias),
      Context.add(TargetOrgRef, orgRef)
    );
    const host: CompatibilityHost = {
      getConnection: (username, input) =>
        run(connection.getConnection(username), Schema.encodeSync(ConnectionErrors), input),
      getTargetOrg: input => run(config.getTargetOrg(), Schema.encodeSync(ConfigErrors), input),
      getAliasesFromUsername: (username, input) => run(alias.getAliasesFromUsername(username), identity<never>, input),
      subscribeOrgChanges: callback =>
        run(
          orgChanges.subscribe(callback).pipe(
            Effect.map(
              ({ stop }) =>
                // Unsubscription is privileged cleanup after admission has closed, before runtime disposal.
                () =>
                  runtime.runPromiseExit(stop).then(exit => encodeExit(exit, identity<never>))
            )
          ),
          identity<never>
        ),
      redact
    };
    return {
      v2: {
        services: {
          ConnectionService,
          ConfigService,
          AliasService,
          TargetOrgRef,
          prebuiltServicesDependencies: context,
          prebuiltServicesLayer: Layer.succeedContext(context).pipe(Layer.merge(logging))
        }
      },
      host,
      close: () => Effect.runPromiseExit(operations.close).then(exit => encodeExit(exit, identity<never>)),
      dispose: () => Effect.runPromise(dispose).then(exit => encodeExit(exit, identity<never>))
    };
  } catch (error) {
    const cleanup = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
    if (Exit.isFailure(cleanup))
      throw new AggregateError([error, cleanup.cause], 'Connection runtime startup and cleanup failed');
    throw error;
  }
};
