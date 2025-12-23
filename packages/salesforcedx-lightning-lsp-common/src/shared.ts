/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { IFileSystemProvider } from './providers/fileSystemDataProvider';

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
 * @param root
 * @returns WorkspaceType for singular root
 */
export const detectWorkspaceHelper = async (
  root: string,
  fileSystemProvider: IFileSystemProvider
): Promise<WorkspaceType> => {
  // Early return if no files are available
  try {
    const allFiles = fileSystemProvider.getAllFileUris();
    if (allFiles.length === 0) {
      return 'UNKNOWN';
    }
  } catch {
    // Error listing files, continue
  }

  try {
    const sfdxProjectFile = getSfdxProjectFile(root);
    const fileStat = fileSystemProvider.getFileStat(sfdxProjectFile);

    if (fileStat?.type === 'file') {
      return 'SFDX';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const fileStat = fileSystemProvider.getFileStat(`${path.join(root, 'workspace-user.xml')}`);
    if (fileStat?.type === 'file') {
      return 'CORE_ALL';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const parentWorkspaceUserUri = path.join(root, '..', 'workspace-user.xml');
    const fileStat = fileSystemProvider.getFileStat(`${parentWorkspaceUserUri}`);
    if (fileStat?.type === 'file') {
      return 'CORE_PARTIAL';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const lwcConfigUri = path.join(root, 'lwc.config.json');
    const fileStat = fileSystemProvider.getFileStat(`${lwcConfigUri}`);
    if (fileStat?.type === 'file') {
      return 'STANDARD_LWC';
    }
  } catch {
    // File doesn't exist, continue
  }

  const packageJson = path.join(root, 'package.json');
  try {
    const packageInfoContent = fileSystemProvider.getFileContent(`${packageJson}`);
    if (!packageInfoContent) {
      throw new Error('Package info not found');
    }
    const packageInfo = JSON.parse(packageInfoContent);
    const dependencies = Object.keys(packageInfo.dependencies ?? {});
    const devDependencies = Object.keys(packageInfo.devDependencies ?? {});
    const allDependencies = [...dependencies, ...devDependencies];
    const hasLWCdependencies = allDependencies.some(key => key.startsWith('@lwc/') || key === 'lwc');

    // any type of @lwc is a dependency
    if (hasLWCdependencies) {
      return 'STANDARD_LWC';
    }

    // has any type of lwc configuration
    if (packageInfo.lwc) {
      return 'STANDARD_LWC';
    }

    if (packageInfo.workspaces) {
      return 'MONOREPO';
    }

    try {
      const lernaJsonUri = path.join(root, 'lerna.json');
      const fileStat = fileSystemProvider.getFileStat(`${lernaJsonUri}`);
      if (fileStat?.type === 'file') {
        return 'MONOREPO';
      }
    } catch {
      // File doesn't exist, continue
    }

    return 'STANDARD';
  } catch {
    // Log error and fallback to setting workspace type to Unknown
  }

  return 'UNKNOWN';
};

/**
 * @param workspaceRoots
 * @returns WorkspaceType, actively not supporting workspaces of mixed type
 */
export const detectWorkspaceType = async (
  workspaceRoots: string[],
  fileSystemProvider: IFileSystemProvider
): Promise<WorkspaceType> => {
  if (workspaceRoots.length === 1) {
    return await detectWorkspaceHelper(workspaceRoots[0], fileSystemProvider);
  }
  for (const root of workspaceRoots) {
    const type = await detectWorkspaceHelper(root, fileSystemProvider);
    if (type !== 'CORE_PARTIAL') {
      return 'UNKNOWN';
    }
  }
  return 'CORE_PARTIAL';
};
