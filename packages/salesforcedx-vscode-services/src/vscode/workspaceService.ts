/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect } from 'effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';

export type WorkspaceService = {
  /** Get the root workspace path, or none if not in a workspace */
  readonly getWorkspacePath: Effect.Effect<Option.Option<string>, never, never>;
};

export const WorkspaceService = Context.GenericTag<WorkspaceService>('WorkspaceService');

export const WorkspaceServiceLive = WorkspaceService.of({
  getWorkspacePath: Effect.sync(() => {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? Option.some(folders[0].uri.fsPath) : Option.none();
  })
});
