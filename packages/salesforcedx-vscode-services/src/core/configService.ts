/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { Cache, Context, Duration, Effect, Layer, pipe } from 'effect';
// import * as vscode from 'vscode';
// import { URI } from 'vscode-uri';
import { WebSdkLayer } from '../observability/spans';
import { fsPrefix } from '../virtualFsProvider/constants';
import { WorkspaceService } from '../vscode/workspaceService';

export type ConfigService = {
  /** Get a ConfigAggregator for the current workspace */
  readonly getConfigAggregator: Effect.Effect<ConfigAggregator, Error, WorkspaceService>;
};

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService');

const createConfigAggregator = (projectPath: string): Effect.Effect<ConfigAggregator, Error, never> =>
  Effect.tryPromise({
    try: () => ConfigAggregator.create({ projectPath }),
    catch: (error: unknown) => new Error(`Failed to get ConfigAggregator at ${projectPath}: ${String(error)}`)
  }).pipe(Effect.withSpan('createConfigAggregator', { attributes: { projectPath } }));

export const ConfigServiceLive = Layer.scoped(
  ConfigService,
  Effect.gen(function* () {
    // Create Effect's Cache with capacity and TTL for better performance and memory management
    const configCache = yield* Cache.make({
      capacity: 50, // Maximum number of cached ConfigAggregators
      timeToLive: Duration.minutes(30), // Cache entries expire after 30 minutes
      lookup: createConfigAggregator // Lookup function that creates ConfigAggregator for a given projectPath
    });

    return {
      getConfigAggregator: pipe(
        WorkspaceService,
        Effect.flatMap(ws => ws.getWorkspaceInfo),
        Effect.flatMap(workspaceDescription =>
          workspaceDescription.isEmpty
            ? Effect.fail(new Error('No workspace project path found'))
            : Effect.succeed(workspaceDescription.path.replace(fsPrefix, '').replace(':/', ''))
        ),
        Effect.tap(projectPath => Effect.annotateCurrentSpan({ projectPath })),
        Effect.flatMap(projectPath =>
          Effect.gen(function* () {
            return yield* configCache.get(projectPath);
          })
        ),
        Effect.withSpan('getConfigAggregator'),
        Effect.provide(WebSdkLayer)
      )
    };
  })
);
