/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { FileType, workspace } from 'vscode';
import { URI } from 'vscode-uri';
import { detectWorkspaceHelper, type WorkspaceFileSystem, type WorkspaceType } from './shared';

/** Resolve path to URI, preserving workspace folder URI scheme if possible. */
const toUri = (filePath: string): URI => {
  // Try to find a workspace folder that contains this path
  const workspaceFolders = workspace.workspaceFolders ?? [];
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath || folder.uri.path;
    if (filePath.startsWith(folderPath)) {
      // Construct URI relative to workspace folder to preserve scheme
      const relativePath = path.relative(folderPath, filePath);
      return URI.parse(`${folder.uri.toString()}/${relativePath.split(path.sep).join('/')}`);
    }
  }
  // Fallback to file:// URI
  return URI.file(filePath);
};

/**
 * Checks if a file exists using VS Code workspace API.
 * In web mode, preserves the workspace folder's URI scheme (memfs, file, etc.)
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const fileUri = toUri(path.resolve(filePath));
    const stat = await workspace.fs.stat(fileUri);
    return stat.type === FileType.File;
  } catch {
    return false;
  }
};

/**
 * Reads file content as string using VS Code workspace API.
 * In web mode, preserves the workspace folder's URI scheme (memfs, file, etc.)
 */
const readFileContent = async (filePath: string): Promise<string | undefined> => {
  try {
    const fileUri = toUri(path.resolve(filePath));
    const fileContent = await workspace.fs.readFile(fileUri);
    return Buffer.from(fileContent).toString('utf8');
  } catch {
    return undefined;
  }
};

const vsCodeFs: WorkspaceFileSystem = { fileExists, readFileContent };

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
