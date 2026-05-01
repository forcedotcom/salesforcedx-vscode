/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FileStat } from './types/fileSystemTypes';
import * as path from 'node:path';
import { FileType, workspace } from 'vscode';
import { URI } from 'vscode-uri';
import { LspFileSystemAccessor } from './providers/lspFileSystemAccessor';
import { detectWorkspaceHelper, type WorkspaceType } from './shared';

/** Resolve path to URI, preserving workspace folder URI scheme if possible. */
const toUri = (filePath: string): URI => {
  const workspaceFolders = workspace.workspaceFolders ?? [];
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath || folder.uri.path;
    if (filePath.startsWith(folderPath)) {
      const relativePath = path.relative(folderPath, filePath);
      return URI.parse(`${folder.uri.toString()}/${relativePath.split(path.sep).join('/')}`);
    }
  }
  return URI.file(filePath);
};

class VsCodeFileSystemAccessor extends LspFileSystemAccessor {
  public override async getFileStat(uri: string): Promise<FileStat | undefined> {
    try {
      const fileUri = toUri(path.resolve(uri));
      const stat = await workspace.fs.stat(fileUri);
      return { exists: true, type: stat.type === FileType.File ? 'file' : 'directory', ctime: stat.ctime, mtime: stat.mtime, size: stat.size };
    } catch {
      return undefined;
    }
  }

  public override async getFileContent(uri: string): Promise<string | undefined> {
    try {
      const fileUri = toUri(path.resolve(uri));
      const fileContent = await workspace.fs.readFile(fileUri);
      return Buffer.from(fileContent).toString('utf8');
    } catch {
      return undefined;
    }
  }
}

const vsCodeFs = new VsCodeFileSystemAccessor();

/**
 * @param workspaceRoots
 * @returns WorkspaceType, actively not supporting workspaces of mixed type
 */
export const detectWorkspaceType = async (workspaceRoots: string[]): Promise<WorkspaceType> => {
  if (workspaceRoots.length === 0) {
    return 'UNKNOWN';
  }
  if (workspaceRoots.length === 1) {
    return detectWorkspaceHelper(workspaceRoots[0], vsCodeFs);
  }
  for (const root of workspaceRoots) {
    const type = await detectWorkspaceHelper(root, vsCodeFs);
    if (type !== 'CORE_PARTIAL') {
      return 'UNKNOWN';
    }
  }
  return 'CORE_PARTIAL';
};
