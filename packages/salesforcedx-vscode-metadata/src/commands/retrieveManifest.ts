/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { retrieveComponentSet } from '../shared/retrieve/retrieveComponentSet';
import { ManifestSelectionRequiredError } from './manifestErrors';

/** Retrieve from the default org using a manifest file */
export const retrieveManifestCommand = Effect.fn('retrieveManifestCommand')(function* (manifestUri?: URI) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const resolved =
      manifestUri ??
      (yield* api.services.EditorService.getActiveEditorUri().pipe(
        Effect.catchTag('NoActiveEditorError', () =>
        new ManifestSelectionRequiredError({ message: nls.localize('retrieve_select_manifest') })
      )
      ));

    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
      yield* componentSetService.getComponentSetFromManifest(resolved)
    );

    yield* retrieveComponentSet({ componentSet }).pipe(
      Effect.catchTag('SourceTrackingConflictError', () =>
        handleConflictWithRetry({
          retryOperation: retrieveComponentSet({ componentSet, ignoreConflicts: true }),
          operationType: 'retrieve'
        })
      )
    );
  });
