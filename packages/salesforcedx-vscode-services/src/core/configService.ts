/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { Global } from '@salesforce/core/global';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import { SdkLayer } from '../observability/spans';
import { fsPrefix } from '../virtualFsProvider/constants';
import { WorkspaceService } from '../vscode/workspaceService';
import { defaultOrgRef } from './defaultOrgService';

const createConfigAggregator = (projectPath: string): Effect.Effect<ConfigAggregator, Error, never> =>
  Effect.tryPromise({
    try: () => ConfigAggregator.create({ projectPath }),
    catch: (error: unknown) => new Error(`Failed to get ConfigAggregator at ${projectPath}: ${String(error)}`)
  }).pipe(Effect.withSpan('createConfigAggregator', { attributes: { projectPath } }));

// Global cache - created once at module level, not scoped to any consumer
const globalConfigCache = Effect.runSync(
  Cache.make({
    capacity: 5, // Maximum number of cached ConfigAggregators
    timeToLive: Duration.minutes(30),
    lookup: createConfigAggregator // Lookup function that creates ConfigAggregator for a given projectPath
  })
);

// when the org changes, invalidate the cache
Effect.runSync(Effect.forkDaemon(defaultOrgRef.changes.pipe(Stream.runForEach(() => globalConfigCache.invalidateAll))));

export class ConfigService extends Effect.Service<ConfigService>()('ConfigService', {
  succeed: {
    /** Get a ConfigAggregator for the current workspace */
    getConfigAggregator: pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? Effect.fail(new Error('No workspace project path found'))
          : Effect.succeed(workspaceDescription.path.replace(fsPrefix, '').replace(':/', ''))
      ),
      Effect.tap(projectPath => Effect.annotateCurrentSpan({ projectPath })),
      Effect.flatMap(projectPath => globalConfigCache.get(projectPath)),
      // stateless when org can change: always reload only on desktop
      Effect.flatMap(agg => (Global.isWeb ? Effect.succeed(agg) : Effect.promise(() => agg.reload()))),
      Effect.tap(agg => Effect.annotateCurrentSpan({ ...agg.getConfig() })),
      Effect.withSpan('getConfigAggregator'),
      Effect.provide(SdkLayer)
    )
  } as const,
  dependencies: [WorkspaceService.Default]
}) {}
