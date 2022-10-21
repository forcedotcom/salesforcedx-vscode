import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import {
  projectPaths,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as pathExists from 'path-exists';
import * as vscode from 'vscode';

function getDialogStartingPathUri(
  extContext: vscode.ExtensionContext
): vscode.Uri | undefined {
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
}

function getLastOpenedLogFolder(
  extContext: vscode.ExtensionContext
): string | undefined {
  const pathToLastOpenedLogFolder = extContext.workspaceState.get<string>(
    LAST_OPENED_LOG_FOLDER_KEY
  );
  return pathToLastOpenedLogFolder;
}

function folderExists(path: string): boolean {
  return pathExists.sync(path);
}

function getUriFor(path: string): vscode.Uri {
  return vscode.Uri.file(path);
}

export const dialogStartingPath = {
  getDialogStartingPathUri,
  getLastOpenedLogFolder,
  folderExists,
  getUriFor
};
