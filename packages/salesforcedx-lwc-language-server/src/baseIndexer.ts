/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IFileSystemProvider, normalizePath, unixify } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';

/** Package directory configuration in sfdx-project.json */
interface SfdxPackageDirectory {
  path: string;
  default?: boolean;
}

/** Structure of sfdx-project.json file */
interface SfdxProjectConfig {
  packageDirectories?: SfdxPackageDirectory[];
  namespace?: string;
  sfdcLoginUrl?: string;
  signupTargetLoginUrl?: string;
  sourceApiVersion?: string;
}

// Utility function to resolve workspace root
// Normalizes the path to ensure consistency (path.resolve() may reintroduce backslashes on Windows)
// On Windows, path.isAbsolute() returns false for Windows-style paths on non-Windows platforms
// So we check for Windows drive letter pattern explicitly
export const getWorkspaceRoot = (workspaceRoot: string): string => {
  // Check if path is already absolute (Unix absolute or Windows absolute)
  // Windows absolute paths start with a drive letter followed by colon and slash (e.g., "d:/" or "D:/")
  const isWindowsAbsolute = /^[A-Za-z]:[/\\]/.test(workspaceRoot);
  const isUnixAbsolute = path.isAbsolute(workspaceRoot);

  if (isUnixAbsolute || isWindowsAbsolute) {
    // Path is already absolute, just normalize it
    return normalizePath(workspaceRoot);
  }
  // Otherwise, resolve relative paths
  return normalizePath(path.resolve(workspaceRoot));
};

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
export const getSfdxPackageDirsPattern = (workspaceRoot: string, fileSystemProvider: IFileSystemProvider): string => {
  const config = getSfdxConfig(workspaceRoot, fileSystemProvider);
  const dirs = config.packageDirectories;
  const paths: string[] = dirs?.map(item => item.path) ?? [];
  return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
};
