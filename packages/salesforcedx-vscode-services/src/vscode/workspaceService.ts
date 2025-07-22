/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect, Layer } from 'effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export type WorkspaceService = {
  /** Get the root workspace path, or none if not in a workspace */
  readonly getWorkspacePath: Effect.Effect<Option.Option<string>, never, never>;
  /** Whether the workspace is a virtual file system */
  readonly isVirtualFs: Effect.Effect<boolean, never, never>;
};

export const WorkspaceService = Context.GenericTag<WorkspaceService>('WorkspaceService');

export const WorkspaceServiceLive = Layer.succeed(WorkspaceService, {
  getWorkspacePath: Effect.sync(() => {
    const folders = vscode.workspace.workspaceFolders;
    console.log('Workspace folders:', folders);
    console.log('Workspace folders length:', folders?.length);
    console.log('Workspace name:', vscode.workspace.name);
    console.log('Workspace URI:', vscode.workspace);
    console.log('First folder URI:', folders?.[0]?.uri);
    console.log('First folder fsPath:', folders?.[0]?.uri.fsPath);
    return folders && folders.length > 0
      ? Option.some(folders[0].uri.toString()) // Use the full URI
      : Option.none();
  }),
  isVirtualFs: Effect.sync(() => isVirtualFs(vscode.workspace.workspaceFolders?.[0]?.uri ?? URI.parse('')))
});

const isVirtualFs = (uri: URI): boolean => uri.scheme !== 'file';
