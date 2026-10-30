/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config, OrgConfigProperties, SfConfigProperties } from '@salesforce/core';
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import {
  ConfigService,
  ConfigWriteError,
  FailedToCreateConfigAggregatorError,
  TargetOrgRef,
  WorkspaceService
} from '@salesforce/vscode-services-v2';
import * as Cache from 'effect/Cache';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { unknownToErrorCause } from './errorCause.js';
import { makeScopedFibers } from './scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';

// The resolved config can contain a decrypted live session id. Never spread it onto spans.
const spanSafeKeys: readonly string[] = [
  OrgConfigProperties.TARGET_ORG,
  OrgConfigProperties.TARGET_DEV_HUB,
  SfConfigProperties.DISABLE_TELEMETRY
];
const spanSafeConfig = (config: Record<string, unknown>) =>
  Object.fromEntries(spanSafeKeys.filter(key => config[key] !== undefined).map(key => [key, config[key]]));
const createAggregator = (projectPath: string) =>
  Effect.tryPromise({
    try: () => ConfigAggregator.create({ projectPath }),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToCreateConfigAggregatorError({
        message: `Failed to create config aggregator: ${cause.message}`,
        cause
      });
    }
  }).pipe(Effect.withSpan('createConfigAggregator (cache miss)', { attributes: { projectPath } }));
const writeError = (error: unknown): ConfigWriteError => {
  const { cause } = unknownToErrorCause(error);
  return new ConfigWriteError({ message: `Failed to write config: ${cause.message}`, cause });
};

/** Cache and org-change subscription share this layer's scope; no daemon or module-global cache. */
export const ConfigServiceLayer = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const workspace = yield* WorkspaceService;
    const orgRef = yield* TargetOrgRef;
    const orgChanges = yield* OrgChanges;
    const operations = yield* ServiceOperations;
    const scopedFibers = yield* makeScopedFibers;
    const cache = yield* Cache.make({ capacity: 5, timeToLive: Duration.minutes(30), lookup: createAggregator });
    yield* Effect.addFinalizer(() => Cache.invalidateAll(cache));
    const subscribed = yield* Deferred.make<void>();
    yield* SubscriptionRef.changes(orgRef).pipe(
      Stream.runForEach(() => Cache.invalidateAll(cache).pipe(Effect.andThen(Deferred.succeed(subscribed, undefined)))),
      // An empty, already-closed subscription is not successful initialization.
      // Deferred.done is a no-op after the first snapshot acknowledged readiness.
      Effect.onExit(exit => Deferred.done(subscribed, Exit.isSuccess(exit) ? Exit.interrupt() : exit)),
      scopedFibers.fork
    );
    // Publish the service only after its initial snapshot/invalidation and subscription are established.
    yield* Deferred.await(subscribed);

    const getConfigAggregator = Effect.fn('ConfigService.getConfigAggregator')(function* () {
      const workspaceInfo = yield* workspace.getWorkspaceInfoOrThrow();
      const projectPath = workspaceInfo.path.replace('memfs', '').replace(':/', '');
      yield* Effect.annotateCurrentSpan({ projectPath });
      const aggregator = yield* Cache.get(cache, projectPath);
      const reloaded = yield* process.env.ESBUILD_PLATFORM === 'web'
        ? Effect.succeed(aggregator)
        : Effect.promise(() => aggregator.reload());
      yield* Effect.annotateCurrentSpan(spanSafeConfig(reloaded.getConfig()));
      return reloaded;
    }, operations.run);
    const invalidateConfigAggregator = Effect.fn('ConfigService.invalidateConfigAggregator')(() =>
      Cache.invalidateAll(cache)
    );
    const readString = Effect.fn('ConfigService.readConfigString')(
      (property: OrgConfigProperties | SfConfigProperties) =>
        getConfigAggregator().pipe(Effect.map(aggregator => aggregator.getPropertyValue<string>(property) ?? undefined))
    );
    const matchesTarget = (property: OrgConfigProperties, username: string, aliases: readonly string[]) =>
      readString(property).pipe(
        Effect.map(target => (target ? target === username || aliases.includes(target) : false))
      );
    return ConfigService.of({
      getConfigAggregator,
      invalidateConfigAggregator,
      getTargetOrg: Effect.fn('ConfigService.getTargetOrg')(() => readString(OrgConfigProperties.TARGET_ORG)),
      getTargetDevHub: Effect.fn('ConfigService.getTargetDevHub')(() => readString(OrgConfigProperties.TARGET_DEV_HUB)),
      isCliTelemetryDisabled: Effect.fn('ConfigService.isCliTelemetryDisabled')(() =>
        readString(SfConfigProperties.DISABLE_TELEMETRY).pipe(Effect.map(value => String(value) === 'true'))
      ),
      isCurrentTargetOrg: Effect.fn('ConfigService.isCurrentTargetOrg')(
        (username: string, aliases: readonly string[]) =>
          matchesTarget(OrgConfigProperties.TARGET_ORG, username, aliases)
      ),
      isCurrentTargetDevHub: Effect.fn('ConfigService.isCurrentTargetDevHub')(
        (username: string, aliases: readonly string[]) =>
          matchesTarget(OrgConfigProperties.TARGET_DEV_HUB, username, aliases)
      ),
      setTargetOrg: Effect.fn('ConfigService.setTargetOrg')(function* (usernameOrAlias: string) {
        const config = yield* Effect.tryPromise({
          try: () => Config.create(Config.getDefaultOptions()),
          catch: writeError
        });
        config.set(OrgConfigProperties.TARGET_ORG, usernameOrAlias);
        yield* Effect.tryPromise({ try: () => config.write(), catch: writeError });
        yield* invalidateConfigAggregator();
      }, operations.run),
      unsetTargetOrg: Effect.fn('ConfigService.unsetTargetOrg')(function* () {
        const generation = yield* orgChanges.begin;
        const config = yield* Effect.promise(() => Config.create(Config.getDefaultOptions()));
        config.unset(OrgConfigProperties.TARGET_ORG);
        yield* Effect.promise(() => config.write());
        yield* invalidateConfigAggregator();
        yield* orgChanges.clearIfCurrent(generation);
      }, operations.run),
      unsetTargetDevHub: Effect.fn('ConfigService.unsetTargetDevHub')(function* () {
        const config = yield* Effect.promise(() => Config.create(Config.getDefaultOptions()));
        config.unset(OrgConfigProperties.TARGET_DEV_HUB);
        yield* Effect.promise(() => config.write());
        yield* invalidateConfigAggregator();
      }, operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
