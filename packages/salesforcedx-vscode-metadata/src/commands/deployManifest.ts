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
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

const deployManifestEffect = (manifestUri?: URI) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const resolved =
      manifestUri ??
      (yield* (yield* api.services.EditorService).getActiveEditorUri.pipe(
        Effect.catchTag('NoActiveEditorError', () => Effect.fail(new Error(nls.localize('deploy_select_manifest'))))
      ));
    // Use path instead of fsPath for memfs URIs (web environments) to avoid backslash conversion issues
    // For file:// URIs, path and fsPath are equivalent
    const manifestPath = process.env.ESBUILD_PLATFORM === 'web' ? resolved.path : resolved.fsPath;

    const deployService = yield* api.services.MetadataDeployService;
    const componentSet = yield* deployService.ensureNonEmptyComponentSet(
      yield* deployService.getComponentSetFromManifest(manifestPath)
    );

    yield* deployComponentSet({ componentSet });
  }).pipe(Effect.withSpan('deployManifest', { attributes: { manifestUri } }), Effect.provide(AllServicesLayer));

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
