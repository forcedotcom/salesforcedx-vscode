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
import { retrieveComponentSet } from '../shared/retrieve/retrieveComponentSet';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';

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
export const retrieveSourcePathsCommand = Effect.fn('retrieveSourcePathsCommand')(
  function* (sourceUri: URI | undefined, uris: URI[] | undefined) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const resolvedSourceUri = sourceUri ?? (yield* api.services.EditorService.getActiveEditorUri());

    if (!resolvedSourceUri) return;

    const componentSetService = yield* api.services.ComponentSetService;
    const resolvedUris = uris?.length ? uris : [resolvedSourceUri];
    yield* api.services.ProjectService.ensureInPackageDirectories(resolvedUris);
    const componentSet = yield* Effect.succeed(Array.from(resolvedUris)).pipe(
      Effect.flatMap(componentSetService.getComponentSetFromUris),
      Effect.flatMap(componentSetService.ensureNonEmptyComponentSet),
      Effect.tap(cs => detectConflicts(cs, 'retrieve'))
    );

    // we can ignore conflicts because we already did the detectConflicts check
    yield* retrieveComponentSet({ componentSet, ignoreConflicts: true });
  },
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', nls.localize('retrieve_this_source_text'))),
  Effect.catchTag('NoActiveEditorError', () =>
    Effect.promise(() => vscode.window.showErrorMessage(nls.localize('retrieve_select_file_or_directory'))).pipe(
      Effect.as(undefined)
    )
  ),
  Effect.catchTag('ConflictsDetectedError', err =>
    handleConflictWithRetry({
      pairs: err.pairs,
      operationType: err.operationType,
      retryOperation: retrieveComponentSet({ componentSet: err.componentSet, ignoreConflicts: true })
    })
  )
);
