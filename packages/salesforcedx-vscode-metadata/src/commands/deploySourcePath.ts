/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

const deployUris = Effect.fn('deploySourcePath.deployUris')(function* (
  uris: Set<URI>,
  options?: { skipConflictCheck?: boolean }
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const componentSetService = yield* api.services.ComponentSetService;
  const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromUris(Array.from(uris))
  );

  if (!options?.skipConflictCheck) {
    const pairs = yield* detectConflicts(componentSet, 'deploy');
    if (pairs.length > 0) {
      return yield* handleConflictWithRetry({
        retryOperation: deployComponentSet({ componentSet }),
        operationType: 'deploy',
        componentSet
      });
    }
  }

  yield* deployComponentSet({ componentSet });
});

export const deployActiveEditorCommand = Effect.fn('deploySourcePath.deployActiveEditor')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const activeEditorUri = yield* api.services.EditorService.getActiveEditorUri().pipe(
    Effect.catchTag('NoActiveEditorError', () =>
      Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_select_file_or_directory'))).pipe(
        Effect.as(undefined)
      )
    )
  );
  if (!activeEditorUri) return;
  return yield* deployUris(new Set([activeEditorUri]));
});

// When a single file is selected and "Deploy Source from Org" is executed,
// sourceUri is passed, and the uris array contains a single element, the same
// path as sourceUri.
//
// When multiple files are selected and "Deploy Source from Org" is executed,
// sourceUri is passed, and is the path to the first selected file, and the uris
// array contains an array of all paths that were selected.
//
// When editing a file and "Deploy This Source from Org" is executed,
// sourceUri is passed, but uris is undefined.

/** Deploy source paths to the default org */
export const deploySourcePathsCommand = Effect.fn('deploySourcePath.deploySourcePaths')(function* (
  sourceUri: URI,
  uris: URI[] = []
) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const urisSet = new Set([sourceUri, ...uris]);
  return yield* deployUris(urisSet);
});
