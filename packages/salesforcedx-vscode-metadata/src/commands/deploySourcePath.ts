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
import { getActiveEditorUri } from '../shared/activeEditorUri';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

const deployPaths = Effect.fn('deployPaths')(function* (paths: Set<string>) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const deployService = yield* api.services.MetadataDeployService;
  const componentSet = yield* deployService.getComponentSetFromPaths(Array.from(paths));
  yield* deployComponentSet({ componentSet, emptyMessage: nls.localize('deploy_no_components_message') });
});

const deployActiveEditorEffect = Effect.fn('deployActiveEditor')(function* () {
  const activeEditorUri = yield* getActiveEditorUri;
  const paths = new Set([activeEditorUri.path]);
  return yield* deployPaths(paths);
});

/** Deploy source paths to the default org */
const deploySourcePathsEffect = Effect.fn('deploySourcePaths')(function* (sourceUri: URI, uris: URI[]) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });

  const paths = new Set([sourceUri.path, ...uris.map(uri => uri.path)]);
  return yield* deployPaths(paths);
});

export const deployActiveEditor = async (): Promise<void> =>
  deployActiveEditorEffect().pipe(
    Effect.catchTag('NoActiveEditorError', () =>
      Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_select_file_or_directory'))).pipe(
        Effect.as(undefined)
      )
    ),
    Effect.provide(AllServicesLayer),
    Effect.runPromise
  );

/** Deploy source paths to the default org */

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

export const deploySourcePaths = async (sourceUri: URI, uris: URI[] = []): Promise<void> =>
  deploySourcePathsEffect(sourceUri, uris).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
