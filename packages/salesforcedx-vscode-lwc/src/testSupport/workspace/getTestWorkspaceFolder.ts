/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../messages';

const reportMissingWorkspaceFolder = (cause?: unknown) => {
  const errorMessage = nls.localize('no_workspace_folder_found_for_test_text');
  return Effect.logError(errorMessage, { cause }).pipe(
    Effect.zipRight(
      Effect.sync(() => {
        void vscode.window.showErrorMessage(errorMessage);
      })
    ),
    Effect.as(undefined)
  );
};

/**
 * If testUri is specified, returns the workspace folder containing the test if it exists.
 * Otherwise, return the first workspace folder if it exists.
 * @param testUri optional testUri
 */
export const getTestWorkspaceFolder = Effect.fn('getTestWorkspaceFolder')(
  function* (testUri?: URI) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri ?? workspaceInfo.uri);
    return yield* isNotUndefined(workspaceFolder)
      ? Effect.succeed(workspaceFolder)
      : reportMissingWorkspaceFolder();
  },
  Effect.catchTag('NoWorkspaceOpenError', reportMissingWorkspaceFolder)
);
