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

const retrievePaths = (paths: Set<string>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
      yield* componentSetService.getComponentSetFromPaths(paths)
    );
    yield* retrieveComponentSet({ componentSet });
  });

/** Retrieve source paths from the default org */
const retrieveSourcePathsEffect = Effect.fn('retrieveSourcePaths')(function* (sourceUri: URI, uris: URI[]) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const paths = new Set([sourceUri.path, ...uris.map(uri => uri.path)]);
  return yield* retrievePaths(paths);
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
      Effect.catchAll(error =>
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const channelService = yield* api.services.ChannelService;
          const errorMessage = error instanceof Error ? error.message : String(error);
          yield* channelService.appendToChannel(`Retrieve failed: ${errorMessage}`);
          yield* Effect.promise(() => vscode.window.showErrorMessage(errorMessage));
        }).pipe(Effect.provide(AllServicesLayer), Effect.as(undefined))
      ),
      Effect.provide(AllServicesLayer)
    )
  );
};
