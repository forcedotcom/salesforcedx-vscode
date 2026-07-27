/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
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
  if (pathToLastOpenedLogFolder && (yield* api.services.FsService.fileOrFolderExists(pathToLastOpenedLogFolder))) {
    return URI.file(pathToLastOpenedLogFolder);
  }
  // If lastOpenedLogFolder isn't defined or doesn't exist then use the
  // same directory that the SFDX download logs command would download to
  // if it exists.
  // The workspace folders are re-read on every ProjectService call, so they can go away between the isEmpty
  // check above and these calls (this runs during activation). A closed workspace means "no starting path",
  // not a failed activation.
  const logsFolder = yield* api.services.ProjectService.getDebugLogsFolder().pipe(
    Effect.orElseSucceed(() => undefined)
  );
  if (logsFolder && (yield* api.services.FsService.fileOrFolderExists(logsFolder))) {
    return logsFolder;
  }
  // If all else fails, fallback to the .sfdx directory in the workspace
  return yield* api.services.ProjectService.getStateFolder().pipe(Effect.orElseSucceed(() => undefined));
});

const getLastOpenedLogFolder = (extContext: vscode.ExtensionContext): string | undefined => {
  const pathToLastOpenedLogFolder = extContext.workspaceState.get<string>(LAST_OPENED_LOG_FOLDER_KEY);
  return pathToLastOpenedLogFolder;
};
