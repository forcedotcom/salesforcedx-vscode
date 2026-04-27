/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, OrgConfigProperties } from '@salesforce/core';
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
      yield* Effect.annotateCurrentSpan({ ...reloadedAgg.getConfig() });
      return reloadedAgg;
    });

    const invalidateConfigAggregator = Effect.fn('ConfigService.invalidateConfigAggregator')(function* () {
      yield* configCache.invalidateAll;
    });

    /** Returns the current target-dev-hub value (alias or username), or undefined if not set */
    const getTargetDevHub = Effect.fn('ConfigService.getTargetDevHub')(function* () {
      const agg = yield* getConfigAggregator();
      const value = agg.getPropertyValue<string>(OrgConfigProperties.TARGET_DEV_HUB);
      return value ? String(value) : undefined;
    });

    /** Returns true if the given username/aliases match the currently configured target org */
    const isCurrentTargetOrg = Effect.fn('ConfigService.isCurrentTargetOrg')(function* (
      username: string,
      aliases: readonly string[]
    ) {
      const agg = yield* getConfigAggregator();
      const targetOrgOrAlias = agg.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG);
      if (!targetOrgOrAlias) return false;
      return targetOrgOrAlias === username || aliases.includes(targetOrgOrAlias);
    });

    /** Returns true if the given username/aliases match the currently configured target dev hub */
    const isCurrentTargetDevHub = Effect.fn('ConfigService.isCurrentTargetDevHub')(function* (
      username: string,
      aliases: readonly string[]
    ) {
      const agg = yield* getConfigAggregator();
      const targetDevHubOrAlias = agg.getPropertyValue<string>(OrgConfigProperties.TARGET_DEV_HUB);
      if (!targetDevHubOrAlias) return false;
      return targetDevHubOrAlias === username || aliases.includes(targetDevHubOrAlias);
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
      getTargetDevHub,
      isCurrentTargetOrg,
      isCurrentTargetDevHub,
      unsetTargetOrg,
      unsetTargetDevHub
    };
  })
}) {}
