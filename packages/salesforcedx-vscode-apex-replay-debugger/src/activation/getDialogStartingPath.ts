/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { projectPaths, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { existsSync } from 'fs';
import * as vscode from 'vscode';

export const getDialogStartingPath = (extContext: vscode.ExtensionContext): vscode.Uri | undefined => {
  if (workspaceUtils.hasRootWorkspace()) {
    // If the user has already selected a document through getLogFileName then
    // use that path if it still exists.
    const pathToLastOpenedLogFolder = getLastOpenedLogFolder(extContext);
    if (pathToLastOpenedLogFolder && folderExists(pathToLastOpenedLogFolder)) {
      const lastOpenedLogFolderUri = getUriFor(pathToLastOpenedLogFolder);
      return lastOpenedLogFolderUri;
    }
    // If lastOpenedLogFolder isn't defined or doesn't exist then use the
    // same directory that the SFDX download logs command would download to
    // if it exists.
    const pathToWorkspaceLogsFolder = projectPaths.debugLogsFolder();
    if (folderExists(pathToWorkspaceLogsFolder)) {
      const workspaceLogsFolderUri = getUriFor(pathToWorkspaceLogsFolder);
      return workspaceLogsFolderUri;
    }
    // If all else fails, fallback to the .sfdx directory in the workspace
    const pathToStateFolder = projectPaths.stateFolder();
    const stateFolderUri = getUriFor(pathToStateFolder);
    return stateFolderUri;
  }
};

const getLastOpenedLogFolder = (extContext: vscode.ExtensionContext): string | undefined => {
  const pathToLastOpenedLogFolder = extContext.workspaceState.get<string>(LAST_OPENED_LOG_FOLDER_KEY);
  return pathToLastOpenedLogFolder;
};

const folderExists = (path: string): boolean => {
  return existsSync(path);
};

const getUriFor = (path: string): vscode.Uri => {
  return vscode.Uri.file(path);
};
