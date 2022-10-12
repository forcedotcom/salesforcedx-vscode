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
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  WorkspaceContextUtil
} from '..';

export function ensureDirectoryExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
}

export function getTestResultsFolder(vscodePath: string, testType: string) {
  const testResultsFolder = path.join(
    vscodePath,
    Global.STATE_FOLDER,
    'tools',
    'testresults',
    testType
  );

  ensureDirectoryExists(testResultsFolder);
  return testResultsFolder;
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

export function fileExtensionsMatch(
  sourceUri: vscode.Uri,
  targetExtension: string
): boolean {
  const extension = sourceUri.path
    .split('.')
    .pop()
    ?.toLowerCase();
  return extension === targetExtension.toLowerCase();
}

function stateFolder(): string {
  return hasRootWorkspace()
    ? path.join(getRootWorkspacePath(), Global.SFDX_STATE_FOLDER)
    : '';
}

async function metadataDirectory(): Promise<string> {
  const username = WorkspaceContextUtil.getInstance().username;
  return path.join(stateFolder(), 'orgs', String(username), 'metadata');
}

function apexTestResults(): string {
  const apexTestResultsFolder = path.join(
    stateFolder(),
    'tools',
    'testresults',
    'apex'
  );
  return apexTestResultsFolder;
}

function apexLanguageServerDatabase(): string | undefined {
  if (!hasRootWorkspace()) {
    return undefined;
  }
  const apexLangServerDbPath = path.join(stateFolder(), 'tools', 'apex.db');
  return apexLangServerDbPath;
}

function lwcTestResults(expectedCwd: string): string {
  // todo: should this use getRootWorkspacePath instead?
  const apexDirPath = path.join(
    expectedCwd,
    Global.STATE_FOLDER,
    'tools',
    'testresults',
    'lwc'
  );
  return apexDirPath;
}

function testResults(vscodePath: string): string {
  // todo: should this use getRootWorkspacePath instead?
  const testResultsDirPath = path.join(
    vscodePath,
    Global.STATE_FOLDER,
    'tools',
    'testresults'
  );
  return testResultsDirPath;
}

function getApexLanguageServerDatabasePath(): string | undefined {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }
  const apexLangServerDbPath = path.join(stateFolder(), 'tools', 'apex.db');
  return apexLangServerDbPath;
}

function debugLogs(): string | undefined {
  const logsDirectory = path.join(stateFolder(), 'tools', 'debug', 'logs');
  return logsDirectory;
}

export const projectPaths = {
  stateFolder,
  metadataDirectory,
  testResults,
  apexTestResults,
  apexLanguageServerDatabase,
  debugLogs,
  lwcTestResults
};
