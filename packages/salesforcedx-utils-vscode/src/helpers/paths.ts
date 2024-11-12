/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core-bundle';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WorkspaceContextUtil } from '..';
import { workspaceUtils } from '../workspaces/workspaceUtils';

export const ORGS = 'orgs';
export const METADATA = 'metadata';
export const TOOLS = 'tools';
export const TEST_RESULTS = 'testresults';
export const APEX = 'apex';
export const DEBUG = 'debug';
export const LOGS = 'logs';
export const APEX_DB = 'apex.db';
export const LWC = 'lwc';
export const SFDX_CONFIG_FILE = 'sfdx-config.json';

export const ensureDirectoryExists = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
};

export const getTestResultsFolder = (vscodePath: string, testType: string) => {
  const pathToTestResultsFolder = path.join(vscodePath, Global.STATE_FOLDER, TOOLS, TEST_RESULTS, testType);

  ensureDirectoryExists(pathToTestResultsFolder);
  return pathToTestResultsFolder;
};

/**
 * Creates a project relative path version of an absolute path.
 *
 * @param fsPath Absolute file path
 * @param packageDirs Package directory paths
 * @returns Relative path for the project
 */
export const getRelativeProjectPath = (fsPath: string = '', packageDirs: string[]) => {
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
};

export const fileExtensionsMatch = (sourceUri: vscode.Uri, targetExtension: string): boolean => {
  const extension = sourceUri.path.split('.').pop()?.toLowerCase();
  return extension === targetExtension.toLowerCase();
};

const stateFolder = (): string => {
  return workspaceUtils.hasRootWorkspace()
    ? path.join(workspaceUtils.getRootWorkspacePath(), Global.SFDX_STATE_FOLDER)
    : '';
};

const metadataFolder = (): string => {
  const username = WorkspaceContextUtil.getInstance().username;
  const pathToMetadataFolder = path.join(projectPaths.stateFolder(), ORGS, String(username), METADATA);
  return pathToMetadataFolder;
};

const apexTestResultsFolder = (): string => {
  const pathToApexTestResultsFolder = path.join(toolsFolder(), TEST_RESULTS, APEX);
  return pathToApexTestResultsFolder;
};

const apexLanguageServerDatabase = (): string => {
  const pathToApexLangServerDb = path.join(toolsFolder(), APEX_DB);
  return pathToApexLangServerDb;
};

const lwcTestResultsFolder = (): string => {
  const pathToLwcTestResultsFolder = path.join(testResultsFolder(), LWC);
  return pathToLwcTestResultsFolder;
};

const testResultsFolder = (): string => {
  const pathToTestResultsFolder = path.join(toolsFolder(), TEST_RESULTS);
  return pathToTestResultsFolder;
};

const debugLogsFolder = (): string => {
  const pathToDebugLogsFolder = path.join(toolsFolder(), DEBUG, LOGS);
  return pathToDebugLogsFolder;
};

const salesforceProjectConfig = (): string => {
  const pathToSalesforceProjectConfig = path.join(projectPaths.stateFolder(), SFDX_CONFIG_FILE);
  return pathToSalesforceProjectConfig;
};

const toolsFolder = (): string => {
  const pathToToolsFolder = path.join(projectPaths.stateFolder(), TOOLS);
  return pathToToolsFolder;
};

const relativeStateFolder = (): string => {
  return Global.STATE_FOLDER;
};

const relativeToolsFolder = (): string => {
  const relativePathToToolsFolder = path.join(projectPaths.relativeStateFolder(), TOOLS);
  return relativePathToToolsFolder;
};

export const projectPaths = {
  stateFolder,
  metadataFolder,
  testResultsFolder,
  apexTestResultsFolder,
  apexLanguageServerDatabase,
  debugLogsFolder,
  salesforceProjectConfig,
  toolsFolder,
  lwcTestResultsFolder,
  relativeStateFolder,
  relativeToolsFolder
};
