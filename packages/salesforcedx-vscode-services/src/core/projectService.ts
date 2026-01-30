/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core/project';
import * as Cache from 'effect/Cache';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as vscode from 'vscode';
import { WorkspaceService } from '../vscode/workspaceService';
import { unknownToErrorCause } from './shared';

export class FailedToResolveSfProjectError extends Data.TaggedError('FailedToResolveSfProjectError')<{
  readonly cause?: Error;
}> {}

const setProjectOpenedContext = (value: boolean) =>
  Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:project_opened', value)).pipe(
    Effect.withSpan('setProjectOpenedContext', { attributes: { value } })
  );

const resolveSfProject = (fsPath: string) =>
  Effect.tryPromise({
    try: () => SfProject.resolve(fsPath),
    catch: error => new FailedToResolveSfProjectError(unknownToErrorCause(error))
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
    /** Check if we're in a Salesforce project (sfdx-project.json exists).  Side effect: sets the 'sf:project_opened' context to true or false */
    isSalesforceProject: pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? setProjectOpenedContext(false).pipe(Effect.as(false))
          : globalSfProjectCache.get(workspaceDescription.fsPath).pipe(
              Effect.tap(() => setProjectOpenedContext(true)),
              Effect.tapError(() => setProjectOpenedContext(false)),
              Effect.map(() => true),
              Effect.catchAll(() => Effect.succeed(false))
            )
      )
    ),
    /** Get the SfProject instance for the workspace (fails if not a Salesforce project).  Side effect: sets the 'sf:project_opened' context to true or false */
    getSfProject: WorkspaceService.pipe(
      Effect.flatMap(ws => ws.getWorkspaceInfoOrThrow),
      Effect.flatMap(workspaceDescription => globalSfProjectCache.get(workspaceDescription.fsPath)),
      Effect.withSpan('getSfProject'),
      Effect.tap(() => setProjectOpenedContext(true)),
      Effect.tapError(() => setProjectOpenedContext(false))
    )
  } as const,
  dependencies: [WorkspaceService.Default]
}) {}

export class NoWorkspaceOpenError extends Data.TaggedError('NoWorkspaceOpenError')<{}> {}
