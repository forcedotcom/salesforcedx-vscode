/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';

// Utility function to resolve workspace root
export const getWorkspaceRoot = (workspaceRoot: string): string => path.resolve(workspaceRoot);

// Utility function to get SFDX configuration
const getSfdxConfig = async (root: string, fileSystemProvider: IFileSystemProvider): Promise<any> => {
  const filename: string = path.join(root, 'sfdx-project.json');

  if (fileSystemProvider) {
    // Try with file:// prefix first
    const content =
      fileSystemProvider.getFileContent(`file://${filename}`) ?? fileSystemProvider.getFileContent(filename);
    if (content) {
      return JSON.parse(content);
    }
  }

  // Fallback - return empty config
  return {};
};

// Utility function to get SFDX package directories pattern
export const getSfdxPackageDirsPattern = async (
  workspaceRoot: string,
  fileSystemProvider: IFileSystemProvider
): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const config = await getSfdxConfig(workspaceRoot, fileSystemProvider);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const dirs = config.packageDirectories;
  const paths: string[] = dirs?.map((item: { path: string }): string => item.path) ?? [];
  return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
};
