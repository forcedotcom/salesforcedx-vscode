/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { isPackageJson } from './types/packageJson';

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

// can be used by LSPFileAccessor or "normal" fs
export type WorkspaceFileSystem = {
  fileExists: (path: string) => Promise<boolean>;
  readFileContent: (path: string) => Promise<string | undefined>;
};

export const isLWC = (type: WorkspaceType): boolean =>
  type === 'SFDX' || type === 'STANDARD_LWC' || type === 'CORE_ALL' || type === 'CORE_PARTIAL';

export const getSfdxProjectFile = (root: string): string => path.join(root, SFDX_PROJECT);

/**
 * @param root
 * @param fs
 * @returns WorkspaceType for a singular root
 */
export const detectWorkspaceHelper = async (root: string, fs: WorkspaceFileSystem): Promise<WorkspaceType> => {
  if (await fs.fileExists(getSfdxProjectFile(root))) {
    return 'SFDX';
  }
  if (await fs.fileExists(path.join(root, 'workspace-user.xml'))) {
    return 'CORE_ALL';
  }
  if (await fs.fileExists(path.join(root, '..', 'workspace-user.xml'))) {
    return 'CORE_PARTIAL';
  }
  if (await fs.fileExists(path.join(root, 'lwc.config.json'))) {
    return 'STANDARD_LWC';
  }

  const packageJsonContent = await fs.readFileContent(path.join(root, 'package.json'));
  if (packageJsonContent) {
    try {
      const parsed: unknown = JSON.parse(packageJsonContent);
      const packageInfo = isPackageJson(parsed) ? parsed : undefined;
      if (packageInfo) {
        const allDeps = [
          ...Object.keys(packageInfo.dependencies ?? {}),
          ...Object.keys(packageInfo.devDependencies ?? {})
        ];
        if (allDeps.some(k => k.startsWith('@lwc/') || k === 'lwc')) {
          return 'STANDARD_LWC';
        }
        if (packageInfo.lwc) {
          return 'STANDARD_LWC';
        }
        if (packageInfo.workspaces) {
          return 'MONOREPO';
        }
        if (await fs.fileExists(path.join(root, 'lerna.json'))) {
          return 'MONOREPO';
        }
        return 'STANDARD';
      }
    } catch (e) {
      console.error(
        `Error encountered while trying to detect workspace type: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return 'UNKNOWN';
};
