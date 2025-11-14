/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IFileSystemProvider, unixify } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';

/** Package directory configuration in sfdx-project.json */
export interface SfdxPackageDirectory {
  path: string;
  default?: boolean;
}

/** Structure of sfdx-project.json file */
export interface SfdxProjectConfig {
  packageDirectories?: SfdxPackageDirectory[];
  namespace?: string;
  sfdcLoginUrl?: string;
  signupTargetLoginUrl?: string;
  sourceApiVersion?: string;
}

// Utility function to resolve workspace root
export const getWorkspaceRoot = (workspaceRoot: string): string => path.resolve(workspaceRoot);

/** Get SFDX configuration from sfdx-project.json */
const getSfdxConfig = (root: string, fileSystemProvider: IFileSystemProvider): SfdxProjectConfig => {
  const filename: string = path.join(root, 'sfdx-project.json');

  if (fileSystemProvider) {
    // Try with file:// prefix first
    const normalizedFilename = unixify(filename);
    const content =
      fileSystemProvider.getFileContent(`file://${normalizedFilename}`) ??
      fileSystemProvider.getFileContent(normalizedFilename);
    if (content) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(content) as SfdxProjectConfig;
    }
  }

  // Fallback - return empty config
  return {};
};

/** Get SFDX package directories pattern from sfdx-project.json */
export const getSfdxPackageDirsPattern = async (
  workspaceRoot: string,
  fileSystemProvider: IFileSystemProvider
): Promise<string> => {
  const config = getSfdxConfig(workspaceRoot, fileSystemProvider);
  const dirs = config.packageDirectories;
  const paths: string[] = dirs?.map(item => item.path) ?? [];
  return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
};
