/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspace, WorkspaceFolder } from 'vscode';

// TODO: consolidate all of these into workspaceUtils
export const hasRootWorkspace = (ws: typeof workspace = workspace) => {
  return ws && ws.workspaceFolders && ws.workspaceFolders.length > 0;
};

export const getRootWorkspace = (): WorkspaceFolder => {
  return hasRootWorkspace() ? workspace.workspaceFolders![0] : ({} as WorkspaceFolder);
};

export const getRootWorkspacePath = (): string => {
  return getRootWorkspace().uri ? getRootWorkspace().uri.fsPath : '';
};
