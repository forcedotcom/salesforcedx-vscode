/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core/project';
import { Cache, Context, Duration, Effect, Layer } from 'effect';
import { pipe } from 'effect/Function';
import { SdkLayer } from '../observability/spans';
import { WorkspaceService } from '../vscode/workspaceService';

export type ProjectService = {
  /** Check if we're in a Salesforce project (sfdx-project.json exists) */
  readonly isSalesforceProject: Effect.Effect<boolean, Error, WorkspaceService>;
  /** Get the SfProject instance for the workspace (fails if not a Salesforce project) */
  readonly getSfProject: Effect.Effect<SfProject, Error, WorkspaceService>;
};

export const ProjectService = Context.GenericTag<ProjectService>('ProjectService');

const resolveSfProject = (fsPath: string): Effect.Effect<SfProject, Error, never> =>
  Effect.tryPromise({
    try: () => SfProject.resolve(fsPath),
    catch: error => new Error('Project Resolution Error', { cause: error })
  }).pipe(Effect.withSpan('resolveSfProject', { attributes: { fsPath } }));

export const ProjectServiceLive = Layer.scoped(
  ProjectService,
  Effect.gen(function* () {
    // Create Effect's Cache for SfProject resolution with capacity and TTL
    const sfProjectCache = yield* Cache.make({
      capacity: 10, // Maximum number of cached SfProject instances
      timeToLive: Duration.minutes(10), // Projects expire after 10 minutes (project structure changes are infrequent)
      lookup: resolveSfProject // Lookup function that resolves SfProject for given fsPath
    });

    const getSfProject = pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? Effect.fail(new Error('No workspace open'))
          : sfProjectCache.get(workspaceDescription.fsPath)
      )
    )
      .pipe(Effect.withSpan('getSfProject'))
      .pipe(Effect.provide(SdkLayer));

    const isSalesforceProject = pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? Effect.succeed(false)
          : sfProjectCache.get(workspaceDescription.fsPath).pipe(
              Effect.map(() => true),
              Effect.catchAll(() => Effect.succeed(false))
            )
      )
    );

    return {
      getSfProject,
      isSalesforceProject
    };
  })
);
