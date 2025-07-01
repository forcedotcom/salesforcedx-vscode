/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger';
import { projectPaths, workspaceUtils, fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export const getDialogStartingPath = async (extContext: vscode.ExtensionContext): Promise<URI | undefined> => {
  if (workspaceUtils.hasRootWorkspace()) {
    // If the user has already selected a document through getLogFileName then
    // use that path if it still exists.
    const pathToLastOpenedLogFolder = getLastOpenedLogFolder(extContext);
    if (pathToLastOpenedLogFolder && (await folderExists(pathToLastOpenedLogFolder))) {
      const lastOpenedLogFolderUri = getUriFor(pathToLastOpenedLogFolder);
      return lastOpenedLogFolderUri;
    }
    // If lastOpenedLogFolder isn't defined or doesn't exist then use the
    // same directory that the SFDX download logs command would download to
    // if it exists.
    const pathToWorkspaceLogsFolder = projectPaths.debugLogsFolder();
    if (await folderExists(pathToWorkspaceLogsFolder)) {
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

const folderExists = async (path: string): Promise<boolean> => await fileOrFolderExists(path);

const getUriFor = (path: string): URI => URI.file(path);
