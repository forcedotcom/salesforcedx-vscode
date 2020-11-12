/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { TextDocument, workspace, WorkspaceFolder } from 'vscode';

export function getDocumentName(document: TextDocument): string {
  const documentPath = document.uri.fsPath;
  return path.basename(documentPath) || '';
}

function hasRootWorkspace(ws: typeof workspace = workspace) {
  return ws && ws.workspaceFolders && ws.workspaceFolders.length > 0;
}

function getRootWorkspace(): WorkspaceFolder {
  return hasRootWorkspace()
    ? workspace.workspaceFolders![0]
    : ({} as WorkspaceFolder);
}

export function getRootWorkspacePath(): string {
  return getRootWorkspace().uri ? getRootWorkspace().uri.fsPath : '';
}
