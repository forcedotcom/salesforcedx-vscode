/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, OrgConfigProperties, SfConfigProperties } from '@salesforce/core';
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { fsPrefix } from '../virtualFsProvider/constants';
import { WorkspaceService } from '../vscode/workspaceService';
import { clearDefaultOrgRef, getDefaultOrgRef } from './defaultOrgRef';
import { unknownToErrorCause } from './shared';

export class FailedToCreateConfigAggregatorError extends Schema.TaggedError<FailedToCreateConfigAggregatorError>()(
  'FailedToCreateConfigAggregatorError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

export class ConfigWriteError extends Schema.TaggedError<ConfigWriteError>()('ConfigWriteError', {
  message: Schema.String,
  cause: Schema.optional(Schema.instanceOf(Error))
}) {}

const configWriteCatch = (error: unknown) => {
  const { cause } = unknownToErrorCause(error);
  return new ConfigWriteError({ message: `Failed to write config: ${cause.message}`, cause });
};

/** Config keys allowed onto a span. The resolved sf config can carry credentials — `org-isv-debugger-sid`
 * is a live session id and is decrypted on read — and spans reach local trace files verbatim, so allow-list
 * instead of spreading the whole config. */
const SPAN_SAFE_CONFIG_KEYS: readonly string[] = [
  OrgConfigProperties.TARGET_ORG,
  OrgConfigProperties.TARGET_DEV_HUB,
  SfConfigProperties.DISABLE_TELEMETRY
];

const spanSafeConfig = (config: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(SPAN_SAFE_CONFIG_KEYS.filter(key => config[key] !== undefined).map(key => [key, config[key]]));

const createConfigAggregator = (projectPath: string) =>
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

export class ConfigService extends Effect.Service<ConfigService>()('ConfigService', {
  accessors: true,
  dependencies: [WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;

    const configCache = yield* Cache.make({
      capacity: 5, // Maximum number of cached ConfigAggregators
      timeToLive: Duration.minutes(30),
      lookup: createConfigAggregator // Lookup function that creates ConfigAggregator for a given projectPath
    });

    // when the org changes, invalidate the cache
    yield* Effect.forkDaemon(
      getDefaultOrgRef().pipe(
        Effect.map(ref => ref.changes),
        Stream.runForEach(() => configCache.invalidateAll)
      )
    );

    /** Get a ConfigAggregator for the current workspace */
    const getConfigAggregator = Effect.fn('ConfigService.getConfigAggregator')(function* () {
      const workspaceDescription = yield* workspaceService.getWorkspaceInfoOrThrow();
      const projectPath = workspaceDescription.path.replace(fsPrefix, '').replace(':/', '');
      yield* Effect.annotateCurrentSpan({ projectPath });
      const agg = yield* configCache.get(projectPath);
      // stateless when org can change: always reload only on desktop
      const reloadedAgg = yield* process.env.ESBUILD_PLATFORM === 'web'
        ? Effect.succeed(agg)
        : Effect.promise(() => agg.reload());
      yield* Effect.annotateCurrentSpan(spanSafeConfig(reloadedAgg.getConfig()));
      return reloadedAgg;
    });

    const invalidateConfigAggregator = Effect.fn('ConfigService.invalidateConfigAggregator')(function* () {
      yield* configCache.invalidateAll;
    });

    /** Reads a string config property from the current aggregator, or undefined if unset */
    const readConfigString = Effect.fn('ConfigService.readConfigString')(function* (
      prop: OrgConfigProperties | SfConfigProperties
    ) {
      const agg = yield* getConfigAggregator();
      return agg.getPropertyValue<string>(prop) ?? undefined;
    });

    /** Returns true when the CLI is configured to opt out of telemetry (`sf config set disable-telemetry`).
     * Duplicated by necessity: vscode-services cannot depend on utils-vscode, so keep this in sync with
     * utils-vscode/src/config/configUtil.ts `ConfigUtil.isTelemetryDisabled`, which reads the same key off its
     * own (separately cached) aggregator. */
    const isCliTelemetryDisabled = Effect.fn('ConfigService.isCliTelemetryDisabled')(function* () {
      const value = yield* readConfigString(SfConfigProperties.DISABLE_TELEMETRY);
      // the CLI writes disable-telemetry as the string 'true', but the aggregator hands back whatever is on
      // disk and a hand-edited config can hold a real boolean — String() accepts both spellings
      return String(value) === 'true';
    });

    /** Returns the current target-org value (alias or username), or undefined if not set */
    const getTargetOrg = Effect.fn('ConfigService.getTargetOrg')(function* () {
      return yield* readConfigString(OrgConfigProperties.TARGET_ORG);
    });

    /** Returns the current target-dev-hub value (alias or username), or undefined if not set */
    const getTargetDevHub = Effect.fn('ConfigService.getTargetDevHub')(function* () {
      return yield* readConfigString(OrgConfigProperties.TARGET_DEV_HUB);
    });

    /** Returns true if the given username/aliases match the currently configured target org */
    const isCurrentTargetOrg = Effect.fn('ConfigService.isCurrentTargetOrg')(function* (
      username: string,
      aliases: readonly string[]
    ) {
      const targetOrgOrAlias = yield* readConfigString(OrgConfigProperties.TARGET_ORG);
      if (!targetOrgOrAlias) return false;
      return targetOrgOrAlias === username || aliases.includes(targetOrgOrAlias);
    });

    /** Returns true if the given username/aliases match the currently configured target dev hub */
    const isCurrentTargetDevHub = Effect.fn('ConfigService.isCurrentTargetDevHub')(function* (
      username: string,
      aliases: readonly string[]
    ) {
      const targetDevHubOrAlias = yield* readConfigString(OrgConfigProperties.TARGET_DEV_HUB);
      if (!targetDevHubOrAlias) return false;
      return targetDevHubOrAlias === username || aliases.includes(targetDevHubOrAlias);
    });

    /** Sets target-org in local project config; caller must refresh defaultOrgRef via ConnectionService.getConnection(). */
    const setTargetOrg = Effect.fn('ConfigService.setTargetOrg')(function* (usernameOrAlias: string) {
      const config = yield* Effect.tryPromise({
        try: () => Config.create(Config.getDefaultOptions()),
        catch: configWriteCatch
      });
      config.set(OrgConfigProperties.TARGET_ORG, usernameOrAlias);
      yield* Effect.tryPromise({ try: () => config.write(), catch: configWriteCatch });
      yield* invalidateConfigAggregator();
    });

    /** Unsets target-org from the local project config and clears the reactive org state */
    const unsetTargetOrg = Effect.fn('ConfigService.unsetTargetOrg')(function* () {
      const config = yield* Effect.promise(() => Config.create(Config.getDefaultOptions()));
      config.unset(OrgConfigProperties.TARGET_ORG);
      yield* Effect.promise(() => config.write());
      yield* invalidateConfigAggregator();
      yield* clearDefaultOrgRef();
    });

    /** Unsets target-dev-hub from the local project config */
    const unsetTargetDevHub = Effect.fn('ConfigService.unsetTargetDevHub')(function* () {
      const config = yield* Effect.promise(() => Config.create(Config.getDefaultOptions()));
      config.unset(OrgConfigProperties.TARGET_DEV_HUB);
      yield* Effect.promise(() => config.write());
      yield* invalidateConfigAggregator();
    });

    return {
      getConfigAggregator,
      invalidateConfigAggregator,
      getTargetOrg,
      getTargetDevHub,
      isCliTelemetryDisabled,
      isCurrentTargetOrg,
      isCurrentTargetDevHub,
      setTargetOrg,
      unsetTargetOrg,
      unsetTargetDevHub
    };
  })
}) {}
