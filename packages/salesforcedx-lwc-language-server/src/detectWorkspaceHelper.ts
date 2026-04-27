/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  WorkspaceType,
  getSfdxProjectFile,
  readPackageJson,
  LspFileSystemAccessor
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';

/**
 * @param root
 * @returns WorkspaceType for singular root
 */
export const detectWorkspaceHelper = async (
  root: string,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<WorkspaceType> => {
  try {
    const sfdxProjectFile = getSfdxProjectFile(root);
    const fileStat = await fileSystemAccessor.getFileStat(sfdxProjectFile);

    if (fileStat?.type === 'file') {
      return 'SFDX';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const fileStat = await fileSystemAccessor.getFileStat(`${path.join(root, 'workspace-user.xml')}`);
    if (fileStat?.type === 'file') {
      return 'CORE_ALL';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const parentWorkspaceUserUri = path.join(root, '..', 'workspace-user.xml');
    const fileStat = await fileSystemAccessor.getFileStat(`${parentWorkspaceUserUri}`);
    if (fileStat?.type === 'file') {
      return 'CORE_PARTIAL';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const lwcConfigUri = path.join(root, 'lwc.config.json');
    const fileStat = await fileSystemAccessor.getFileStat(`${lwcConfigUri}`);
    if (fileStat?.type === 'file') {
      return 'STANDARD_LWC';
    }
  } catch {
    // File doesn't exist, continue
  }

  try {
    const packageInfo = await readPackageJson(root, fileSystemAccessor);
    if (!packageInfo) {
      throw new Error('Package info not found');
    }
    const dependencies = Object.keys(packageInfo.dependencies ?? {});
    const devDependencies = Object.keys(packageInfo.devDependencies ?? {});
    const allDependencies: string[] = [...dependencies, ...devDependencies];
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
      const fileStat = await fileSystemAccessor.getFileStat(`${lernaJsonUri}`);
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
