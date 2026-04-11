/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { retrieveComponentSet } from '../shared/retrieve/retrieveComponentSet';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';
import { ManifestSelectionRequiredError } from './manifestErrors';

/** Retrieve from the default org using a manifest file */
export const retrieveManifestCommand = Effect.fn('retrieveManifestCommand')(
  function* (manifestUri?: URI) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const resolved = manifestUri ?? (yield* api.services.EditorService.getActiveEditorUri());

    const componentSet = yield* Effect.succeed(resolved).pipe(
      Effect.flatMap(uri => api.services.ComponentSetService.getComponentSetFromManifest(uri)),
      Effect.flatMap(api.services.ComponentSetService.ensureNonEmptyComponentSet),
      Effect.tap(cs => detectConflicts(cs, 'retrieve'))
    );

    yield* retrieveComponentSet({ componentSet, ignoreConflicts: true });
  },
  Effect.catchTag(
    'NoActiveEditorError',
    () => new ManifestSelectionRequiredError({ message: nls.localize('retrieve_select_manifest') })
  ),
  Effect.catchTag('ConflictsDetectedError', err =>
    handleConflictWithRetry({
      pairs: err.pairs,
      operationType: err.operationType,
      retryOperation: retrieveComponentSet({ componentSet: err.componentSet, ignoreConflicts: true })
    })
  ),
  withConfigurableSuccessNotification(
    nls.localize('command_succeeded_text', nls.localize('retrieve_in_manifest_text'))
  )
);
