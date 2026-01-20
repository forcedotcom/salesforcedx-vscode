/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { retrieveComponentSet } from '../shared/retrieve/retrieveComponentSet';

const retrievePaths = (uris: Set<URI>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
      yield* componentSetService.getComponentSetFromUris(uris)
    );
    yield* retrieveComponentSet({ componentSet });
  });

/** Retrieve source paths from the default org */
const retrieveSourcePathsEffect = Effect.fn('retrieveSourcePaths')(function* (sourceUri: URI, uris: URI[]) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  return yield* retrievePaths(new Set([sourceUri, ...uris]));
});

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

export const retrieveSourcePaths = async (sourceUri: URI | undefined, uris: URI[] | undefined): Promise<void> => {
  const resolvedSourceUri =
    sourceUri ??
    (await Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* (yield* api.services.EditorService).getActiveEditorUri;
      })
        .pipe(Effect.provide(AllServicesLayer))
        .pipe(
          Effect.catchTag('NoActiveEditorError', () =>
            Effect.promise(() =>
              vscode.window.showErrorMessage(nls.localize('retrieve_select_file_or_directory'))
            ).pipe(Effect.as(undefined))
          )
        )
    ));

  if (!resolvedSourceUri) {
    return;
  }

  const resolvedUris = uris?.length ? uris : [resolvedSourceUri];
  await Effect.runPromise(
    retrieveSourcePathsEffect(resolvedSourceUri, resolvedUris).pipe(
      Effect.catchTag('SourceTrackingConflictError', error =>
        displayErrorMessage(nls.localize('retrieve_source_conflicts_detected', error.conflicts.join(',')))
      ),
      Effect.catchAll(error =>
        Effect.gen(function* () {
          const errorMessage = error instanceof Error ? error.message : String(error);
          yield* displayErrorMessage(`Retrieve failed: ${errorMessage}`);
        }).pipe(Effect.as(undefined))
      ),
      Effect.provide(AllServicesLayer)
    )
  );
};

const displayErrorMessage = Effect.fn('displayErrorMessage')(function* (msg: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(`Retrieve failed: ${msg}`);
  yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
  yield* Effect.promise(() => vscode.window.showErrorMessage(msg));
});
