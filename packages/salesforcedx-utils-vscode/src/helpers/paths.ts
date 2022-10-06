/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getRootWorkspacePath } from '..';

export function ensureDirectoryExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
}

export function getTestResultsFolder(vscodePath: string, testType: string) {
  const dirPath = path.join(
    vscodePath,
    '.sfdx',
    'tools',
    'testresults',
    testType
  );

  ensureDirectoryExists(dirPath);
  return dirPath;
}

/**
 * Creates a project relative path version of an absolute path.
 *
 * @param fsPath Absolute file path
 * @param packageDirs Package directory paths
 * @returns Relative path for the project
 */
export function getRelativeProjectPath(
  fsPath: string = '',
  packageDirs: string[]
) {
  let packageDirIndex;
  for (let packageDir of packageDirs) {
    if (!packageDir.startsWith(path.sep)) {
      packageDir = path.sep + packageDir;
    }
    if (!packageDir.endsWith(path.sep)) {
      packageDir = packageDir + path.sep;
    }
    packageDirIndex = fsPath.indexOf(packageDir);
    if (packageDirIndex !== -1) {
      packageDirIndex += 1;
      break;
    }
  }
  return packageDirIndex !== -1 ? fsPath.slice(packageDirIndex) : fsPath;
}

export function fileExtensionsMatch(sourceUri: vscode.Uri, targetExtension: string): boolean {
  const extension = sourceUri.path.split('.').pop()?.toLowerCase();
  return extension === targetExtension.toLowerCase();
}

function getSfdxDirectoryPath(): string {
  return path.join(
    getRootWorkspacePath(),
    Global.SFDX_STATE_FOLDER
  );
}

function getMetadataDirectoryPath(username: string): string {
  return path.join(
    getSfdxDirectoryPath(),
    'orgs',
    username,
    'metadata'
  );
}

export const projectPath = {
  getSfdxDirectoryPath,
  getMetadataDirectoryPath
}