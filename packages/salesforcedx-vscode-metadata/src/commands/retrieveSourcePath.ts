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
import { handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { retrieveComponentSet } from '../shared/retrieve/retrieveComponentSet';

/** Retrieve source paths from the default org */
// When a single file is selected and "Retrieve Source from Org" is executed,
// sourceUri is passed, and the uris array contains a single element, the same
// path as sourceUri.
//
// When multiple files are selected and "Retrieve Source from Org" is executed,
// sourceUri is passed, and is the path to the first selected file, and the uris
// array contains an array of all paths that were selected.
//
// When editing a file and "Retrieve This Source from Org" is executed,
// sourceUri is passed, but uris is undefined.
export const retrieveSourcePathsCommand = Effect.fn('retrieveSourcePathsCommand')(function* (
  sourceUri: URI | undefined,
  uris: URI[] | undefined
) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const resolvedSourceUri =
      sourceUri ??
      (yield* api.services.EditorService.getActiveEditorUri().pipe(
        Effect.catchTag('NoActiveEditorError', () =>
          Effect.promise(() => vscode.window.showErrorMessage(nls.localize('retrieve_select_file_or_directory'))).pipe(
            Effect.as(undefined)
          )
        )
      ));

    if (!resolvedSourceUri) {
      return;
    }

    const resolvedUris = uris?.length ? uris : [resolvedSourceUri];
    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
      yield* componentSetService.getComponentSetFromUris(Array.from(resolvedUris))
    );

    yield* retrieveComponentSet({ componentSet }).pipe(
      Effect.catchTag('SourceTrackingConflictError', () =>
        handleConflictWithRetry({
          retryOperation: retrieveComponentSet({ componentSet, ignoreConflicts: true }),
          operationType: 'retrieve'
        })
      )
    );
  });
