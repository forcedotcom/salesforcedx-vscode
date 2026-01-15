/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as vscode from 'vscode';

const STATE_FOLDER = '.sfdx';
const TOOLS = 'tools';
const TEST_RESULTS = 'testresults';

/**
 * Creates a directory if it doesn't exist, using vscode.workspace.fs
 * In web mode with virtual file systems, directories are created automatically by memfs
 */
const createDirectory = async (dirPath: string): Promise<void> => {
  // Desktop mode - normal directory creation
  try {
    const uri = vscode.Uri.file(dirPath);
    await vscode.workspace.fs.createDirectory(uri);
  } catch (error) {
    // Check if directory already exists
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(dirPath));
      if (stat.type !== vscode.FileType.Directory) {
        throw new Error(`Path exists but is not a directory: ${dirPath}`);
      }
    } catch {
      if (process.env.ESBUILD_PLATFORM === 'web') {
        // Directory doesn't exist - in web mode this might be OK if using virtual fs
        // The fs polyfill should handle it, so we don't throw
        console.debug(`[Apex Testing] Could not create/verify directory in web mode: ${dirPath}`, error);
      } else {
        // Directory doesn't exist, rethrow original error
        throw error;
      }
    }
  }
};

/**
 * Gets the test results folder path and creates it if it doesn't exist.
 * Replaces getTestResultsFolder from @salesforce/salesforcedx-utils-vscode
 */
export const getTestResultsFolder = async (vscodePath: string, testType: string): Promise<string> => {
  // In web mode with empty or invalid paths, return a placeholder path
  if (process.env.ESBUILD_PLATFORM === 'web' && (!vscodePath || vscodePath.trim() === '')) {
    return path.join('/tmp', STATE_FOLDER, TOOLS, TEST_RESULTS, testType);
  }
  const pathToTestResultsFolder = path.join(vscodePath, STATE_FOLDER, TOOLS, TEST_RESULTS, testType);
  await createDirectory(pathToTestResultsFolder);
  return pathToTestResultsFolder;
};
