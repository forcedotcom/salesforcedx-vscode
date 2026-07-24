/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core/global';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { workspaceUtils } from '../workspaces/workspaceUtils';

export const TOOLS = 'tools';
export const TEST_RESULTS = 'testresults';
export const APEX = 'apex';
export const DEBUG = 'debug';
export const LOGS = 'logs';
export const SFDX_CONFIG_FILE = 'sfdx-config.json';

export const fileExtensionsMatch = (sourceUri: URI, targetExtension: string): boolean => {
  const extension = sourceUri.path.split('.').pop()?.toLowerCase();
  return extension === targetExtension.toLowerCase();
};

const stateFolder = (): string =>
  workspaceUtils.hasRootWorkspace() ? path.join(workspaceUtils.getRootWorkspacePath(), Global.SFDX_STATE_FOLDER) : '';

const apexTestResultsFolder = (): string => {
  const pathToApexTestResultsFolder = path.join(toolsFolder(), TEST_RESULTS, APEX);
  return pathToApexTestResultsFolder;
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

export const projectPaths = {
  stateFolder,
  apexTestResultsFolder,
  debugLogsFolder,
  salesforceProjectConfig
};
