/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { fsPrefix } from '../virtualFsProvider/constants';
import { WorkspaceService } from '../vscode/workspaceService';
import { getDefaultOrgRef } from './defaultOrgRef';
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

    return { getConfigAggregator, invalidateConfigAggregator };
  })
}) {}
