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
import { getActiveEditorUri } from './activeEditorUri';
import { deployComponentSet } from './deployComponentSet';

/** Deploy manifest to the default org */
const deployManifestEffect = Effect.fn('deployManifest')(function* (manifestUri?: URI) {
  yield* Effect.annotateCurrentSpan({ manifestUri });

  const resolved = manifestUri ?? (yield* getActiveEditorUri);

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const deployService = yield* api.services.MetadataDeployService;
  const componentSet = yield* deployService.getComponentSetFromManifest(resolved.fsPath);

  yield* deployComponentSet({ componentSet, emptyMessage: nls.localize('deploy_no_components_message') });
});

/** Deploy manifest to the default org */
export const deployManifest = async (manifestUri?: URI): Promise<void> =>
  Effect.runPromise(
    deployManifestEffect(manifestUri).pipe(
      Effect.catchTag('NoActiveEditorError', () =>
        Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_select_manifest'))).pipe(
          Effect.as(undefined)
        )
      ),
      Effect.provide(AllServicesLayer)
    )
  );
