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

const ORGS = 'orgs';
const METADATA = 'metadata';
const TOOLS = 'tools';
const TEST_RESULTS = 'testresults';
const APEX = 'apex';
const DEBUG = 'debug';
const LOGS = 'logs';
const APEX_DB = 'apex.db';

export function ensureDirectoryExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
}

export function getTestResultsFolder(vscodePath: string, testType: string) {
  const pathToTestResultsFolder = path.join(
    vscodePath,
    Global.STATE_FOLDER,
    TOOLS,
    TEST_RESULTS,
    testType
  );

  ensureDirectoryExists(pathToTestResultsFolder);
  return pathToTestResultsFolder;
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

async function metadataFolder(): Promise<string> {
  const username = WorkspaceContextUtil.getInstance().username;
  const pathToMetadataFolder = path.join(
    stateFolder(),
    ORGS,
    String(username),
    METADATA
  );
  return pathToMetadataFolder;
}

function apexTestResultsFolder(): string {
  const pathToApexTestResultsFolder = path.join(
    stateFolder(),
    TOOLS,
    TEST_RESULTS,
    APEX
  );
  return pathToApexTestResultsFolder;
}

function apexLanguageServerDatabase(): string | undefined {
  if (!hasRootWorkspace()) {
    return undefined;
  }
  const pathToApexLangServerDb = path.join(stateFolder(), TOOLS, APEX_DB);
  return pathToApexLangServerDb;
}

function debugLogsFolder(): string | undefined {
  const pathToDebugLogsFolder = path.join(stateFolder(), TOOLS, DEBUG, LOGS);
  return pathToDebugLogsFolder;
}

export const projectPaths = {
  stateFolder,
  metadataFolder,
  apexTestResultsFolder,
  apexLanguageServerDatabase,
  debugLogsFolder
};
