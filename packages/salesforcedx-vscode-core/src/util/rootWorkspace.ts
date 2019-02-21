import { workspace, WorkspaceFolder } from 'vscode';

export function hasRootWorkspace(ws: typeof workspace = workspace ) {
  return (ws && ws.workspaceFolders && ws.workspaceFolders.length > 0);
}

export function getRootWorkspace(): WorkspaceFolder {
  return hasRootWorkspace() ? workspace.workspaceFolders![0] : {} as WorkspaceFolder;
}

export function getRootWorkspaceFsPath(): string {
  return getRootWorkspace().uri ? getRootWorkspace().uri.fsPath : '';
}

export function getRootWorkspacePath(): string {
  return getRootWorkspace().uri ? getRootWorkspace().uri.path : '';
}
