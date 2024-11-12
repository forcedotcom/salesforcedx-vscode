/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspace, WorkspaceFolder } from 'vscode';

const hasRootWorkspace = (ws: typeof workspace = workspace) =>
  ws && ws.workspaceFolders && ws.workspaceFolders.length > 0;

const getRootWorkspace = (): WorkspaceFolder =>
  hasRootWorkspace() ? workspace.workspaceFolders![0] : ({} as WorkspaceFolder);

const getRootWorkspacePath = (): string => (getRootWorkspace().uri ? getRootWorkspace().uri.fsPath : '');

export const workspaceUtils = {
  hasRootWorkspace,
  getRootWorkspace,
  getRootWorkspacePath
};
