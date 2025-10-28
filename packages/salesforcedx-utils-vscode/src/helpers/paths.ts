/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core/global';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { WorkspaceContextUtil } from '..';
import { workspaceUtils } from '../workspaces/workspaceUtils';
import { createDirectory } from './fs';

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

export const getTestResultsFolder = async (vscodePath: string, testType: string) => {
  const pathToTestResultsFolder = path.join(vscodePath, Global.STATE_FOLDER, TOOLS, TEST_RESULTS, testType);
  await createDirectory(pathToTestResultsFolder);
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

export const fileExtensionsMatch = (sourceUri: URI, targetExtension: string): boolean =>
  sourceUri.path.split('.').pop()?.toLowerCase() === targetExtension.toLowerCase();

const stateFolder = (): string =>
  workspaceUtils.hasRootWorkspace() ? path.join(workspaceUtils.getRootWorkspacePath(), Global.SFDX_STATE_FOLDER) : '';

const metadataFolder = (): string =>
  path.join(projectPaths.stateFolder(), ORGS, String(WorkspaceContextUtil.getInstance().username), METADATA);

const apexTestResultsFolder = (): string => path.join(toolsFolder(), TEST_RESULTS, APEX);

const apexLanguageServerDatabase = (): string => path.join(toolsFolder(), APEX_DB);

const lwcTestResultsFolder = (): string => path.join(testResultsFolder(), LWC);

const testResultsFolder = (): string => path.join(toolsFolder(), TEST_RESULTS);

const debugLogsFolder = (): string => path.join(toolsFolder(), DEBUG, LOGS);

const salesforceProjectConfig = (): string => path.join(projectPaths.stateFolder(), SFDX_CONFIG_FILE);

const toolsFolder = (): string => path.join(projectPaths.stateFolder(), TOOLS);

const relativeStateFolder = (): string => Global.STATE_FOLDER;

const relativeToolsFolder = (): string => path.join(projectPaths.relativeStateFolder(), TOOLS);

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
