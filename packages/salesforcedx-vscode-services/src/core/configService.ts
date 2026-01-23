/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as Cache from 'effect/Cache';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import { fsPrefix } from '../virtualFsProvider/constants';
import { WorkspaceService } from '../vscode/workspaceService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { unknownToErrorCause } from './shared';

export class FailedToCreateConfigAggregatorError extends Data.TaggedError('FailedToCreateConfigAggregatorError')<{
  readonly cause: unknown;
}> {}

const createConfigAggregator = (projectPath: string) =>
  Effect.tryPromise({
    try: () => ConfigAggregator.create({ projectPath }),
    catch: error => new FailedToCreateConfigAggregatorError(unknownToErrorCause(error))
  }).pipe(Effect.withSpan('createConfigAggregator (cache miss)', { attributes: { projectPath } }));

// Global cache - created once at module level, not scoped to any consumer
const globalConfigCache = Effect.runSync(
  Cache.make({
    capacity: 5, // Maximum number of cached ConfigAggregators
    timeToLive: Duration.minutes(30),
    lookup: createConfigAggregator // Lookup function that creates ConfigAggregator for a given projectPath
  })
);

// when the org changes, invalidate the cache
Effect.runSync(Effect.forkDaemon(getDefaultOrgRef().pipe(
  Effect.map(ref => ref.changes),
  Stream.runForEach(() => globalConfigCache.invalidateAll)
)));

export class ConfigService extends Effect.Service<ConfigService>()('ConfigService', {
  succeed: {
    /** Get a ConfigAggregator for the current workspace */
    getConfigAggregator: pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfoOrThrow),
      Effect.flatMap(workspaceDescription =>
        Effect.succeed(workspaceDescription.path.replace(fsPrefix, '').replace(':/', ''))
      ),
      Effect.tap(projectPath => Effect.annotateCurrentSpan({ projectPath })),
      Effect.flatMap(projectPath => globalConfigCache.get(projectPath)),
      // stateless when org can change: always reload only on desktop
      Effect.flatMap(agg =>
        process.env.ESBUILD_PLATFORM === 'web' ? Effect.succeed(agg) : Effect.promise(() => agg.reload())
      ),
      Effect.tap(agg => Effect.annotateCurrentSpan({ ...agg.getConfig() })),
      Effect.withSpan('getConfigAggregator')
    )
  } as const,
  dependencies: [WorkspaceService.Default]
}) {}
