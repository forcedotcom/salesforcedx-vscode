/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect } from 'effect';
import * as Option from 'effect/Option';
import { WorkspaceService } from '../vscode/workspaceService';
import { SfProject } from '@salesforce/core';

export type ProjectService = {
  /** Check if we're in a Salesforce project (sfdx-project.json exists) */
  readonly isSalesforceProject: Effect.Effect<boolean, Error, WorkspaceService>;
  /** Get the SfProject instance for the workspace (fails if not a Salesforce project) */
  readonly getSfProject: Effect.Effect<SfProject, Error, WorkspaceService>;
};

export const ProjectService = Context.GenericTag<ProjectService>('ProjectService');

export const ProjectServiceLive = ProjectService.of({
  getSfProject: Effect.gen(function* () {
    const ws = yield* WorkspaceService;
    const maybePath = yield* ws.getWorkspacePath;
    if (Option.isNone(maybePath)) return yield* Effect.fail(new Error('No workspace open'));
    return yield* Effect.tryPromise({
      try: () => SfProject.resolve(maybePath.value),
      catch: error => new Error(`Not a Salesforce project: ${String(error)}`)
    });
  }),

  isSalesforceProject: Effect.catchAll(
    Effect.flatMap(
      Effect.sync(() => undefined), // dummy, will be replaced
      () => ProjectServiceLive.getSfProject
    ),
    () => Effect.succeed(false)
  ).pipe(
    Effect.as(true),
    Effect.catchAll(() => Effect.succeed(false))
  )
});
