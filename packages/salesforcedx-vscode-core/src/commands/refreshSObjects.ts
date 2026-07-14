/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import { isError } from 'effect/Predicate';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { telemetryService } from '../telemetry';

const SOBJECTS_DIR = 'sobjects';
const STANDARDOBJECTS_DIR = 'standardObjects';

const getSObjectsDirectory = (projectPath: string) => path.join(projectPath, '.sfdx', 'tools', SOBJECTS_DIR);

const getStandardSObjectsDirectory = (projectPath: string) =>
  path.join(projectPath, '.sfdx', 'tools', SOBJECTS_DIR, STANDARDOBJECTS_DIR);

const extractErrorMessage = (error: unknown): string => {
  if (isError(error)) return error.message;
  if (typeof error === 'object' && error !== null) {
    if ('error' in error && isError(error.error)) return error.error.message;
    if ('message' in error && typeof error.message === 'string') return error.message;
  }
  return String(error);
};

export const initSObjectDefinitions = async (projectPath: string, isSettingEnabled: boolean) => {
  if (projectPath) {
    const sobjectFolder = isSettingEnabled
      ? getSObjectsDirectory(projectPath)
      : getStandardSObjectsDirectory(projectPath);
    const refreshSource = isSettingEnabled ? 'startup' : 'startupmin';

    if (!(await fileOrFolderExists(sobjectFolder))) {
      telemetryService.sendEventData('sObjectRefreshNotification', { type: refreshSource }, undefined);
      try {
        await vscode.commands.executeCommand('sf.internal.refreshsobjects', refreshSource);
      } catch (e) {
        telemetryService.sendException(
          'initSObjectDefinitionsError',
          `Error: ${extractErrorMessage(e)} with sobjectRefreshStartup = ${isSettingEnabled}`
        );
        throw e;
      }
    }
  }
};
