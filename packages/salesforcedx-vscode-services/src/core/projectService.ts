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
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { WorkspaceService } from '../vscode/workspaceService';
import { unknownToErrorCause } from './shared';

export class FailedToResolveSfProjectError extends Schema.TaggedError<FailedToResolveSfProjectError>()(
  'FailedToResolveSfProjectError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

const setProjectOpenedContext = (value: boolean) =>
  Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:project_opened', value)).pipe(
    Effect.withSpan('setProjectOpenedContext', { attributes: { value } })
  );

const resolveSfProject = (fsPath: string) =>
  Effect.tryPromise({
    try: () => SfProject.resolve(fsPath),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToResolveSfProjectError({
        message: `Failed to resolve SfProject at "${fsPath}": ${cause.message}`,
        cause
      });
    }
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
  accessors: true,
  dependencies: [WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;

    /** Check if we're in a Salesforce project (sfdx-project.json exists).  Side effect: sets the 'sf:project_opened' context to true or false */
    const isSalesforceProject = Effect.fn('ProjectService.isSalesforceProject')(function* () {
      const workspaceDescription = yield* workspaceService.getWorkspaceInfo();

      if (workspaceDescription.isEmpty) {
        yield* setProjectOpenedContext(false);
        return false;
      }

      return yield* globalSfProjectCache.get(workspaceDescription.fsPath).pipe(
        Effect.tap(() => setProjectOpenedContext(true)),
        Effect.tapError(() => setProjectOpenedContext(false)),
        Effect.map(() => true),
        Effect.catchTag('FailedToResolveSfProjectError', () => Effect.succeed(false))
      );
    });

    /** Get the SfProject instance for the workspace (fails if not a Salesforce project).  Side effect: sets the 'sf:project_opened' context to true or false */
    const getSfProject = Effect.fn('ProjectService.getSfProject')(function* () {
      const workspaceDescription = yield* workspaceService.getWorkspaceInfoOrThrow();
      const project = yield* globalSfProjectCache
        .get(workspaceDescription.fsPath)
        .pipe(Effect.tapError(() => setProjectOpenedContext(false)));
      yield* setProjectOpenedContext(true);
      return project;
    });

    return { isSalesforceProject, getSfProject };
  })
}) {}

export class NoWorkspaceOpenError extends Data.TaggedError('NoWorkspaceOpenError')<{}> {}
