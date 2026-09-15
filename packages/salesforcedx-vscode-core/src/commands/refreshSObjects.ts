/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { telemetryService } from '../telemetry';

const SOBJECTS_DIR = 'sobjects';
const STANDARDOBJECTS_DIR = 'standardObjects';

const getSObjectsDirectory = (projectPath: string) => path.join(projectPath, '.sfdx', 'tools', SOBJECTS_DIR);

const getStandardSObjectsDirectory = (projectPath: string) =>
  path.join(projectPath, '.sfdx', 'tools', SOBJECTS_DIR, STANDARDOBJECTS_DIR);

export const initSObjectDefinitions = async (projectPath: string, isSettingEnabled: boolean) => {
  if (projectPath) {
    const sobjectFolder = isSettingEnabled
      ? getSObjectsDirectory(projectPath)
      : getStandardSObjectsDirectory(projectPath);
    const refreshSource = isSettingEnabled ? 'startup' : 'startupmin';

    if (!(await fileOrFolderExists(sobjectFolder))) {
      telemetryService.sendEventData('sObjectRefreshNotification', { type: refreshSource }, undefined);
      await vscode.commands.executeCommand('sf.internal.refreshsobjects', refreshSource);
    }
  }
};
