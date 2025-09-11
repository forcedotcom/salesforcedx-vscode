/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core/project';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { SdkLayer } from '../observability/spans';
import { WorkspaceService } from '../vscode/workspaceService';

const resolveSfProject = (fsPath: string): Effect.Effect<SfProject, Error, never> =>
  Effect.tryPromise({
    try: () => SfProject.resolve(fsPath),
    catch: error => new Error('Project Resolution Error', { cause: error })
  }).pipe(Effect.withSpan('resolveSfProject', { attributes: { fsPath } }));

// Global cache - created once at module level, not scoped to any consumer
const globalSfProjectCache = Effect.runSync(
  Cache.make({
    capacity: 10, // Maximum number of cached SfProject instances
    timeToLive: Duration.minutes(10), // Projects expire after 10 minutes (project structure changes are infrequent)
    lookup: resolveSfProject // Lookup function that resolves SfProject for given fsPath
  }).pipe(Effect.withSpan('sfProjectCache'))
);

export class ProjectService extends Effect.Service<ProjectService>()('ProjectService', {
  succeed: {
    /** Check if we're in a Salesforce project (sfdx-project.json exists) */
    isSalesforceProject: pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? Effect.succeed(false)
          : globalSfProjectCache.get(workspaceDescription.fsPath).pipe(
              Effect.map(() => true),
              Effect.catchAll(() => Effect.succeed(false))
            )
      )
    ),
    /** Get the SfProject instance for the workspace (fails if not a Salesforce project) */
    getSfProject: WorkspaceService.pipe(
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? Effect.fail(new Error('No workspace open'))
          : globalSfProjectCache.get(workspaceDescription.fsPath)
      ),
      Effect.withSpan('getSfProject'),
      Effect.provide(SdkLayer)
    )
  } as const,
  dependencies: [WorkspaceService.Default]
}) {}
