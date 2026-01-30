/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  IFileSystemProvider,
  Logger,
  NormalizedPath,
  normalizePath
} from '@salesforce/salesforcedx-lightning-lsp-common';
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
export const getWorkspaceRoot = (workspaceRoot: string): NormalizedPath => {
  // Check if path is already absolute (Unix absolute or Windows absolute)
  // Windows absolute paths start with a drive letter followed by colon and slash (e.g., "d:/" or "D:/")
  const isWindowsAbsolute = /^[A-Za-z]:[/\\]/.test(workspaceRoot);
  const isUnixAbsolute = path.isAbsolute(workspaceRoot);

  if (isUnixAbsolute || isWindowsAbsolute) {
    // Path is already absolute, just normalize it
    return normalizePath(workspaceRoot);
  }
  // Otherwise, resolve relative paths
  const resolved = path.resolve(workspaceRoot);
  return normalizePath(resolved);
};

/** Get SFDX configuration from sfdx-project.json */
const getSfdxConfig = (root: NormalizedPath, fileSystemProvider: IFileSystemProvider): SfdxProjectConfig => {
  const filename = normalizePath(path.join(root, 'sfdx-project.json'));

  if (fileSystemProvider) {
    // Also check with URI format in case that's needed
    const allFileUris = fileSystemProvider.getAllFileUris();

    // Try to find the exact match
    const exactMatch = allFileUris.find(uri => normalizePath(uri) === filename);

    const content = fileSystemProvider.getFileContent(filename);

    // If content not found with direct path, try with exact match URI if found
    if (!content && exactMatch) {
      const contentFromUri = fileSystemProvider.getFileContent(exactMatch);
      if (contentFromUri) {
        try {
          return JSON.parse(contentFromUri);
        } catch (error) {
          Logger.error(
            `[getSfdxConfig] Error parsing JSON from URI: ${error instanceof Error ? error.message : String(error)}`,
            error
          );
        }
      }
    }

    if (content) {
      try {
        return JSON.parse(content);
      } catch (error) {
        Logger.error(
          `[getSfdxConfig] Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`,
          error
        );
      }
    }
  }
  return {};
};

/** Get SFDX package directories pattern from sfdx-project.json */
export const getSfdxPackageDirsPattern = (
  workspaceRoot: NormalizedPath,
  fileSystemProvider: IFileSystemProvider
): string => {
  const config = getSfdxConfig(workspaceRoot, fileSystemProvider);
  const dirs = config.packageDirectories;
  const paths: string[] = dirs?.map(item => item.path) ?? [];

  if (paths.length === 0) {
    return '';
  }

  const result = paths.length === 1 ? paths[0] : `{${paths.join(',')}}`;
  return result;
};
