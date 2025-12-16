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

/** Deploy source paths to the default org */
const deploySourcePathsEffect = Effect.fn('deploySourcePaths')(function* (
  sourceUri: URI | URI[] | undefined,
  uris: URI[] | undefined,
  isDeployOnSave?: boolean | undefined
) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris, isDeployOnSave });

  // When the source is deployed via the command palette, both sourceUri and uris are
  // each undefined, and sourceUri needs to be obtained from the active text editor.
  const resolvedSourceUri = sourceUri ?? (yield* getActiveEditorUri);

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
  //
  // When "Push-or-deploy-on-save" is enabled, the first parameter
  // passed in (sourceUri) is actually an array and not a single URI.

  const resolvedUris = uris?.length ? uris : Array.isArray(resolvedSourceUri) ? resolvedSourceUri : [resolvedSourceUri];
  const paths = resolvedUris.map(uri => uri.fsPath);

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const deployService = yield* api.services.MetadataDeployService;
  const componentSet = yield* deployService.getComponentSetFromPaths(paths);

  yield* deployComponentSet({ componentSet, emptyMessage: nls.localize('deploy_no_components_message') });
});

/** Deploy source paths to the default org */
export const deploySourcePaths = async (
  sourceUri?: URI | URI[],
  uris?: URI[],
  isDeployOnSave?: boolean
): Promise<void> =>
  deploySourcePathsEffect(sourceUri, uris, isDeployOnSave).pipe(
    Effect.catchTag('NoActiveEditorError', () =>
      Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_select_file_or_directory'))).pipe(
        Effect.as(undefined)
      )
    ),
    Effect.provide(AllServicesLayer),
    Effect.runPromise
  );
