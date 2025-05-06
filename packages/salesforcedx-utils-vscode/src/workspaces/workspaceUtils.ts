/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspace, WorkspaceFolder } from 'vscode';

export const hasRootWorkspace = (ws: typeof workspace = workspace) => Boolean(ws?.workspaceFolders?.length);

export const getRootWorkspace = (): WorkspaceFolder =>
  hasRootWorkspace() ? workspace.workspaceFolders![0] : ({} as WorkspaceFolder);

export const getRootWorkspacePath = (): string => (getRootWorkspace().uri ? getRootWorkspace().uri.fsPath : '');

export const workspaceUtils = {
  hasRootWorkspace,
  getRootWorkspace,
  getRootWorkspacePath
};
