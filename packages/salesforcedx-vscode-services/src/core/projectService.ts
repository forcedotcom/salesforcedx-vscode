/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { Context, Effect } from 'effect';

export type ProjectService = {
  /** Get the root workspace path */
  readonly getRootPath: Effect.Effect<string | undefined, never, never>;

  /** Check if we're in a Salesforce project */
  readonly isSalesforceProject: Effect.Effect<boolean, never, never>;
};

export const ProjectService = Context.GenericTag<ProjectService>('ProjectService');

export const ProjectServiceLive = ProjectService.of({
  getRootPath: Effect.sync(() => getRootWorkspacePath()),

  isSalesforceProject: Effect.gen(function* () {
    const rootPath = yield* Effect.sync(() => getRootWorkspacePath());
    return rootPath !== undefined;
  })
});
