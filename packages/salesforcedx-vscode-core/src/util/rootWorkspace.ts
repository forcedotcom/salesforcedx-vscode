import { workspace, WorkspaceFolder } from 'vscode';

export function hasRootWorkspace(ws: typeof workspace = workspace ) {
  return ws && ws.workspaceFolders && ws.workspaceFolders.length;
}

export function getRootWorkspace(): WorkspaceFolder {
  return hasRootWorkspace() ? workspace.workspaceFolders![0] : {} as WorkspaceFolder;
}

export function getRootWorkspacePath() {
  return getRootWorkspace().uri.path;
}
