/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';

/**
 * In browser / virtual workspaces (e.g. Code Builder), plain `file://` URIs under the project root may not be
 * openable by `vscode.diff` ("No file system handle registered"). Re-express a `file` URI using the workspace
 * folder's URI scheme and path so the workbench resolves it like other workspace files.
 */
export const rebaseFileUriToWorkspaceFolder = (uri: URI): URI => {
  if (uri.scheme !== 'file') {
    return uri;
  }
  const vscodeUri = URI.file(uri.fsPath);
  const folder =
    typeof vscode.workspace.getWorkspaceFolder === 'function'
      ? vscode.workspace.getWorkspaceFolder(vscodeUri) ?? findFolderByFsPathPrefix(uri)
      : findFolderByFsPathPrefix(uri);
  if (!folder) {
    return uri;
  }

  const relativeFromApi =
    typeof vscode.workspace.asRelativePath === 'function'
      ? vscode.workspace.asRelativePath(vscodeUri, false)
      : vscodeUri.fsPath;
  const relative =
    relativeFromApi === vscodeUri.fsPath ? computeManualRelativeToFolder(folder, uri) : relativeFromApi;

  if (relative === vscodeUri.fsPath) {
    return uri;
  }
  if (!relative) {
    return URI.parse(folder.uri.toString());
  }
  const normalized = relative.replaceAll('\\', '/');
  if (normalized.startsWith('../')) {
    return uri;
  }
  const segments = normalized.split('/').filter(Boolean);
  const folderUri = URI.parse(folder.uri.toString());
  return segments.length > 0 ? Utils.joinPath(folderUri, ...segments) : folderUri;
};

const computeManualRelativeToFolder = (folder: vscode.WorkspaceFolder, uri: URI): string => {
  const rootPath = folder.uri.fsPath.replaceAll('\\', '/').replace(/\/$/, '');
  const filePath = uri.fsPath.replaceAll('\\', '/');
  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}/`)) {
    return uri.fsPath;
  }
  return filePath === rootPath ? '' : filePath.slice(rootPath.length + 1);
};

const findFolderByFsPathPrefix = (uri: URI): vscode.WorkspaceFolder | undefined => {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return undefined;
  }
  const normalizedFile = uri.fsPath.replaceAll('\\', '/');
  return folders.find(f => {
    const root = f.uri.fsPath.replaceAll('\\', '/').replace(/\/$/, '');
    return normalizedFile === root || normalizedFile.startsWith(`${root}/`);
  });
};
