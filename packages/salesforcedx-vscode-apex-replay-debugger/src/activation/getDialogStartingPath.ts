/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { projectPaths, fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { LAST_OPENED_LOG_FOLDER_KEY } from '../debuggerConstants';

export const getDialogStartingPath = Effect.fn('ApexReplayDebugger.getDialogStartingPath')(function* (
  extContext: vscode.ExtensionContext
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isEmpty } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  if (isEmpty) return undefined;
  // If the user has already selected a document through getLogFileName then
  // use that path if it still exists.
  const pathToLastOpenedLogFolder = getLastOpenedLogFolder(extContext);
  if (pathToLastOpenedLogFolder && (yield* Effect.promise(() => fileOrFolderExists(pathToLastOpenedLogFolder)))) {
    return getUriFor(pathToLastOpenedLogFolder);
  }
  // If lastOpenedLogFolder isn't defined or doesn't exist then use the
  // same directory that the SFDX download logs command would download to
  // if it exists.
  const pathToWorkspaceLogsFolder = projectPaths.debugLogsFolder();
  if (yield* Effect.promise(() => fileOrFolderExists(pathToWorkspaceLogsFolder))) {
    return getUriFor(pathToWorkspaceLogsFolder);
  }
  // If all else fails, fallback to the .sfdx directory in the workspace
  return getUriFor(projectPaths.stateFolder());
});

const getLastOpenedLogFolder = (extContext: vscode.ExtensionContext): string | undefined => {
  const pathToLastOpenedLogFolder = extContext.workspaceState.get<string>(LAST_OPENED_LOG_FOLDER_KEY);
  return pathToLastOpenedLogFolder;
};

const getUriFor = (path: string): URI => URI.file(path);
