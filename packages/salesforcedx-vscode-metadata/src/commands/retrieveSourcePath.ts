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
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { retrieveFromOutcome } from '../shared/retrieve/retrieveFromOutcome';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';
import { withPreparationProgress } from '../utils/withPreparationProgress';

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
    const channelService = yield* api.services.ChannelService;
    const resolvedSourceUri = sourceUri ?? (yield* api.services.EditorService.getActiveEditorUri());

    if (!resolvedSourceUri) return;

    const componentSetService = yield* api.services.ComponentSetService;
    const resolvedUris = uris?.length ? uris : [resolvedSourceUri];
    yield* api.services.ProjectService.ensureInPackageDirectories(resolvedUris);
    const spec = { kind: 'paths' as const, uris: resolvedUris.map(u => u.toString()) };

    // Helper that performs the retrieve. Closes over resolved URIs so retry can re-use them.
    const performRetrieve = Effect.gen(function* () {
      // Conflict detection stays on the existing ComponentSet path (deferred migration).
      yield* Effect.succeed(Array.from(resolvedUris)).pipe(
        Effect.flatMap(componentSetService.getComponentSetFromUris),
        Effect.flatMap(componentSetService.ensureNonEmptyComponentSet),
        withPreparationProgress('retrieve', cs => detectConflicts(cs, 'retrieve'))
      );

      // Retrieve is now DATA-ONLY: services builds + retrieves + returns an owned RetrieveOutcome.
      yield* channelService.appendToChannel('Starting metadata retrieval...');
      const outcome = yield* api.services.MetadataRetrieveService.retrieveToSource(spec, { ignoreConflicts: true });
      return yield* retrieveFromOutcome(outcome);
    });

    return yield* performRetrieve.pipe(
      Effect.catchTag('ConflictsDetectedError', err =>
        handleConflictWithRetry({
          pairs: err.pairs,
          operationType: err.operationType,
          // On retry, conflicts were acknowledged — re-run with the same spec (closes over `resolvedUris`).
          retryOperation: performRetrieve
        })
      )
    );
  },
  Effect.catchTag('NoActiveEditorError', () =>
    Effect.promise(() => vscode.window.showErrorMessage(nls.localize('retrieve_select_file_or_directory'))).pipe(
      Effect.as(undefined)
    )
  ),
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', nls.localize('retrieve_this_source_text')))
);
