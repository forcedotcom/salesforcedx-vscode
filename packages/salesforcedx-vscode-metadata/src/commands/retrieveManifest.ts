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

const retrieveManifestEffect = (manifestUri?: URI) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const resolved =
      manifestUri ??
      (yield* (yield* api.services.EditorService).getActiveEditorUri.pipe(
        Effect.catchTag('NoActiveEditorError', () => Effect.fail(new Error(nls.localize('retrieve_select_manifest'))))
      ));
    // Use path instead of fsPath for memfs URIs (web environments) to avoid backslash conversion issues
    // For file:// URIs, path and fsPath are equivalent
    const manifestPath = process.env.ESBUILD_PLATFORM === 'web' ? resolved.path : resolved.fsPath;

    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
      yield* componentSetService.getComponentSetFromManifest(manifestPath)
    );

    yield* retrieveComponentSet({ componentSet, ignoreConflicts: false });
  }).pipe(Effect.withSpan('retrieveManifest', { attributes: { manifestUri } }), Effect.provide(AllServicesLayer));

/** Retrieve manifest from the default org */
export const retrieveManifest = async (manifestUri?: URI): Promise<void> =>
  Effect.runPromise(
    retrieveManifestEffect(manifestUri).pipe(
      // handle all other errors generically
      Effect.catchAll(error =>
        Effect.promise(() => vscode.window.showErrorMessage(nls.localize('retrieve_failed', error.message)))
      ),
      Effect.as(undefined),
      Effect.provide(AllServicesLayer)
    )
  );
