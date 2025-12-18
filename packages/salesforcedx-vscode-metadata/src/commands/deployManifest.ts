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

/** Deploy manifest to the default org */
const deployManifestEffect = Effect.fn('deployManifest')(function* (manifestUri?: URI) {
  yield* Effect.annotateCurrentSpan({ manifestUri });

  const resolved =
    manifestUri ??
    (yield* getActiveEditorUri.pipe(
      Effect.catchTag('NoActiveEditorError', () => Effect.fail(new Error(nls.localize('deploy_select_manifest'))))
    ));
  // Use path instead of fsPath for memfs URIs (web environments) to avoid backslash conversion issues
  // For file:// URIs, path and fsPath are equivalent
  const manifestPath = process.env.ESBUILD_PLATFORM === 'web' ? resolved.path : resolved.fsPath;

  const deployService = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.MetadataDeployService;
  const componentSet = yield* deployService.getComponentSetFromManifest(manifestPath);

  if (Array.from(componentSet.getSourceComponents()).length === 0) {
    return yield* Effect.fail(new Error(nls.localize('deploy_no_components_message')));
  }
  yield* deployComponentSet({ componentSet, emptyMessage: nls.localize('deploy_no_components_message') });
});

/** Deploy manifest to the default org */
export const deployManifest = async (manifestUri?: URI): Promise<void> =>
  Effect.runPromise(
    deployManifestEffect(manifestUri).pipe(
      // handle all other errors generically
      Effect.catchAll(error =>
        Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_failed', error.message)))
      ),
      Effect.as(undefined),
      Effect.provide(AllServicesLayer)
    )
  );
