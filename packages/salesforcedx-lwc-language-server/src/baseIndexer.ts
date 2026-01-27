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
  Logger.info(`[getSfdxConfig] Looking for config at: ${filename}`);
  Logger.info(`[getSfdxConfig] fileSystemProvider exists: ${!!fileSystemProvider}`);

  if (fileSystemProvider) {
    // Check if file exists first
    const fileExists = fileSystemProvider.fileExists(filename);
    Logger.info(`[getSfdxConfig] fileExists(${filename}): ${fileExists}`);

    // Also check with URI format in case that's needed
    const allFileUris = fileSystemProvider.getAllFileUris();
    const matchingFiles = allFileUris.filter(uri => uri.includes('sfdx-project.json'));
    Logger.info(
      `[getSfdxConfig] Found ${matchingFiles.length} files containing 'sfdx-project.json': ${JSON.stringify(matchingFiles)}`
    );

    // Try to find the exact match
    const exactMatch = allFileUris.find(uri => normalizePath(uri) === filename);
    Logger.info(`[getSfdxConfig] Exact match for ${filename}: ${exactMatch ?? 'not found'}`);

    const content = fileSystemProvider.getFileContent(filename);
    Logger.info(`[getSfdxConfig] File content exists: ${!!content}, length: ${content?.length ?? 0}`);

    // If content not found with direct path, try with exact match URI if found
    if (!content && exactMatch) {
      Logger.info(`[getSfdxConfig] Trying to get content using exact match URI: ${exactMatch}`);
      const contentFromUri = fileSystemProvider.getFileContent(exactMatch);
      Logger.info(`[getSfdxConfig] Content from URI: ${!!contentFromUri}, length: ${contentFromUri?.length ?? 0}`);
      if (contentFromUri) {
        try {
          const parsed = JSON.parse(contentFromUri);
          Logger.info(`[getSfdxConfig] Parsed config from URI: ${JSON.stringify(parsed, null, 2)}`);
          Logger.info(
            `[getSfdxConfig] packageDirectories exists: ${!!parsed.packageDirectories}, length: ${parsed.packageDirectories?.length ?? 0}`
          );
          return parsed;
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
        const parsed = JSON.parse(content);
        Logger.info(`[getSfdxConfig] Parsed config: ${JSON.stringify(parsed, null, 2)}`);
        Logger.info(
          `[getSfdxConfig] packageDirectories exists: ${!!parsed.packageDirectories}, length: ${parsed.packageDirectories?.length ?? 0}`
        );
        return parsed;
      } catch (error) {
        Logger.error(
          `[getSfdxConfig] Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`,
          error
        );
        Logger.error(`[getSfdxConfig] Content preview: ${content.substring(0, 200)}`);
      }
    } else {
      Logger.info('[getSfdxConfig] File content is null/undefined - file may not exist or not loaded yet');
      Logger.info(`[getSfdxConfig] Total files in provider: ${allFileUris.length}`);
      Logger.info(`[getSfdxConfig] Sample files (first 10): ${JSON.stringify(allFileUris.slice(0, 10))}`);
      Logger.info(
        '[getSfdxConfig] NOTE: sfdx-project.json exists in workspace but not yet loaded into file system provider. ' +
          'This is expected during initial startup. The file will be loaded by bootstrapWorkspaceAwareness and ' +
          'the config will be re-read during delayed initialization. Using fallback pattern detection for now.'
      );
    }
  } else {
    Logger.info('[getSfdxConfig] fileSystemProvider is null/undefined');
  }

  // Fallback - return empty config
  Logger.info('[getSfdxConfig] Returning empty config as fallback');
  return {};
};

/** Get SFDX package directories pattern from sfdx-project.json */
export const getSfdxPackageDirsPattern = (
  workspaceRoot: NormalizedPath,
  fileSystemProvider: IFileSystemProvider
): string => {
  Logger.info(`[getSfdxPackageDirsPattern] Called with workspaceRoot: ${workspaceRoot}`);
  const config = getSfdxConfig(workspaceRoot, fileSystemProvider);
  Logger.info(`[getSfdxPackageDirsPattern] Config received: ${JSON.stringify(config)}`);
  const dirs = config.packageDirectories;
  Logger.info(
    `[getSfdxPackageDirsPattern] packageDirectories: ${dirs ? JSON.stringify(dirs) : 'undefined/null'}, type: ${typeof dirs}, isArray: ${Array.isArray(dirs)}`
  );
  const paths: string[] = dirs?.map(item => item.path) ?? [];
  Logger.info(`[getSfdxPackageDirsPattern] Extracted paths: ${JSON.stringify(paths)}, length: ${paths.length}`);

  if (paths.length === 0) {
    Logger.info(
      '[getSfdxPackageDirsPattern] No packageDirectories found in sfdx-project.json. ' +
        "This is expected if the file hasn't been loaded yet. " +
        'The component indexer will be initialized during performDelayedInitialization when the file is available.'
    );
    // Return empty pattern - component indexer should not be created until sfdx-project.json is available
    // This will be handled during performDelayedInitialization
    return '';
  }

  const result = paths.length === 1 ? paths[0] : `{${paths.join(',')}}`;
  Logger.info(`[getSfdxPackageDirsPattern] Returning pattern from config: ${result}`);
  return result;
};
