/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core';
import { Context, Effect, Layer } from 'effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { WorkspaceService } from '../vscode/workspaceService';

export type ProjectService = {
  /** Check if we're in a Salesforce project (sfdx-project.json exists) */
  readonly isSalesforceProject: Effect.Effect<boolean, Error, WorkspaceService>;
  /** Get the SfProject instance for the workspace (fails if not a Salesforce project) */
  readonly getSfProject: Effect.Effect<SfProject, Error, WorkspaceService>;
};

export const ProjectService = Context.GenericTag<ProjectService>('ProjectService');

export const ProjectServiceLive = Layer.effect(
  ProjectService,
  Effect.gen(function* () {
    const getSfProject = pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspacePath),
      Effect.flatMap(maybePath =>
        Option.isNone(maybePath)
          ? Effect.fail(new Error('No workspace open'))
          : Effect.tryPromise({
              try: () => SfProject.resolve(maybePath.value),
              catch: error => new Error(`Not a Salesforce project: ${String(error)}`)
            })
      )
    );

    const isSalesforceProject = pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspacePath),
      Effect.flatMap(maybePath =>
        Option.isNone(maybePath)
          ? Effect.succeed(false)
          : Effect.tryPromise({
              try: () => SfProject.resolve(maybePath.value),
              catch: () => false
            }).pipe(
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
