/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { FileType, Uri, workspace } from 'vscode';

// utility methods shared with the vscode extension

const SFDX_PROJECT = 'sfdx-project.json';

export type WorkspaceType =
  | 'STANDARD'
  | 'STANDARD_LWC'
  | 'MONOREPO'
  | 'MONOREPO_LWC'
  | 'SFDX'
  | 'CORE_ALL'
  | 'CORE_PARTIAL'
  | 'UNKNOWN';

export const isLWC = (type: WorkspaceType): boolean =>
  type === 'SFDX' || type === 'STANDARD_LWC' || type === 'CORE_ALL' || type === 'CORE_PARTIAL';

export const getSfdxProjectFile = (root: string): string => path.join(root, SFDX_PROJECT);

/**
 * Gets the workspace folder URI for a given path, preserving the scheme (memfs, file, etc.)
 * Handles both absolute paths and relative paths (including parent directory traversal)
 */
const getWorkspaceFolderUriForPath = (filePath: string, baseRoot?: string): Uri | null => {
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    return null;
  }

  // Normalize the path (resolve .. and . segments)
  // In web mode, we need to handle paths relative to workspace folders
  const normalizedPath = baseRoot ? path.resolve(baseRoot, filePath) : path.resolve(filePath);

  // Find the workspace folder that contains this path
  for (const folder of workspace.workspaceFolders) {
    const folderPath = folder.uri.fsPath ?? folder.uri.path;
    // Normalize folder path for comparison
    const normalizedFolderPath = path.resolve(folderPath);

    if (normalizedPath.startsWith(normalizedFolderPath + path.sep) || normalizedPath === normalizedFolderPath) {
      // Use the workspace folder's URI scheme and join the relative path
      const relativePath = path.relative(normalizedFolderPath, normalizedPath);
      // Convert path separators to forward slashes for URI
      const uriPath = relativePath.split(path.sep).join('/');
      return Uri.joinPath(folder.uri, uriPath);
    }
  }

  // If no matching workspace folder found, try to use the first one's scheme
  const firstFolder = workspace.workspaceFolders[0];
  // If the path is absolute and doesn't match any folder, use file:// scheme as fallback
  if (path.isAbsolute(filePath)) {
    return Uri.file(filePath);
  }
  // Otherwise, try to join with the first workspace folder
  // Convert path separators to forward slashes for URI
  const relativeUriPath = filePath.split(path.sep).join('/');
  return Uri.joinPath(firstFolder.uri, relativeUriPath);
};

/**
 * Checks if a file exists using VS Code workspace API
 * In web mode, preserves the workspace folder's URI scheme (memfs, file, etc.)
 */
const fileExists = async (filePath: string, baseRoot?: string): Promise<boolean> => {
  try {
    // Try to use workspace folder URI to preserve scheme (memfs, file, etc.)
    const fileUri = getWorkspaceFolderUriForPath(filePath, baseRoot) ?? Uri.file(filePath);
    const stat = await workspace.fs.stat(fileUri);
    return stat.type === FileType.File;
  } catch {
    return false;
  }
};

/**
 * Reads file content as string using VS Code workspace API
 * In web mode, preserves the workspace folder's URI scheme (memfs, file, etc.)
 */
const readFileContent = async (filePath: string, baseRoot?: string): Promise<string | null> => {
  try {
    // Try to use workspace folder URI to preserve scheme (memfs, file, etc.)
    const fileUri = getWorkspaceFolderUriForPath(filePath, baseRoot) ?? Uri.file(filePath);
    const fileContent = await workspace.fs.readFile(fileUri);
    return Buffer.from(fileContent).toString('utf8');
  } catch {
    return null;
  }
};

/**
 * @param root
 * @returns WorkspaceType for singular root
 */
const detectWorkspaceTypeHelper = async (root: string): Promise<WorkspaceType> => {
  if (await fileExists(getSfdxProjectFile(root), root)) {
    return 'SFDX';
  }
  if (await fileExists(path.join(root, 'workspace-user.xml'), root)) {
    return 'CORE_ALL';
  }
  if (await fileExists(path.join(root, '..', 'workspace-user.xml'), root)) {
    return 'CORE_PARTIAL';
  }

  if (await fileExists(path.join(root, 'lwc.config.json'), root)) {
    return 'STANDARD_LWC';
  }

  const packageJson = path.join(root, 'package.json');
  const packageJsonContent = await readFileContent(packageJson, root);
  if (packageJsonContent) {
    try {
      const packageInfo: unknown = JSON.parse(packageJsonContent);
      if (packageInfo && typeof packageInfo === 'object' && packageInfo !== null) {
        // Safely access properties without type assertions
        let dependenciesObj: unknown;
        let devDependenciesObj: unknown;
        let lwc: unknown;
        let workspaces: unknown;

        for (const [key, value] of Object.entries(packageInfo)) {
          if (key === 'dependencies') {
            dependenciesObj = value;
          } else if (key === 'devDependencies') {
            devDependenciesObj = value;
          } else if (key === 'lwc') {
            lwc = value;
          } else if (key === 'workspaces') {
            workspaces = value;
          }
        }

        const dependencies =
          dependenciesObj && typeof dependenciesObj === 'object' && dependenciesObj !== null
            ? Object.keys(dependenciesObj)
            : [];
        const devDependencies =
          devDependenciesObj && typeof devDependenciesObj === 'object' && devDependenciesObj !== null
            ? Object.keys(devDependenciesObj)
            : [];
        const allDependencies = [...dependencies, ...devDependencies];
        const hasLWCdependencies = allDependencies.some(key => key.startsWith('@lwc/') || key === 'lwc');

        // any type of @lwc is a dependency
        if (hasLWCdependencies) {
          return 'STANDARD_LWC';
        }

        // has any type of lwc configuration
        if (lwc) {
          return 'STANDARD_LWC';
        }

        if (workspaces) {
          return 'MONOREPO';
        }

        if (await fileExists(path.join(root, 'lerna.json'), root)) {
          return 'MONOREPO';
        }

        return 'STANDARD';
      }
    } catch (e) {
      // Log error and fallback to setting workspace type to Unknown
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`Error encountered while trying to detect workspace type ${errorMessage}`);
    }
  }

  return 'UNKNOWN';
};

/**
 * @param workspaceRoots
 * @returns WorkspaceType, actively not supporting workspaces of mixed type
 */
export const detectWorkspaceType = async (workspaceRoots: string[]): Promise<WorkspaceType> => {
  if (workspaceRoots.length === 1) {
    return await detectWorkspaceTypeHelper(workspaceRoots[0]);
  }
  for (const root of workspaceRoots) {
    const type = await detectWorkspaceTypeHelper(root);
    if (type !== 'CORE_PARTIAL') {
      return 'UNKNOWN';
    }
  }
  return 'CORE_PARTIAL';
};
