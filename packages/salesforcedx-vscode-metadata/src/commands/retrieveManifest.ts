/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { retrieveFromOutcome } from '../shared/retrieve/retrieveFromOutcome';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';
import { withPreparationProgress } from '../utils/withPreparationProgress';
import { ManifestSelectionRequiredError } from './manifestErrors';

/** Retrieve from the default org using a manifest file */
export const retrieveManifestCommand = Effect.fn('retrieveManifestCommand')(
  function* (manifestUri?: URI) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    const resolved = manifestUri ?? (yield* api.services.EditorService.getActiveEditorUri());
    const spec = { kind: 'manifest' as const, manifestUri: resolved.toString() };

    // Helper that performs the retrieve. Closes over resolved URI so retry can re-use it.
    const performRetrieve = Effect.gen(function* () {
      // Conflict detection stays on the existing ComponentSet path (deferred migration).
      yield* Effect.succeed(resolved).pipe(
        Effect.flatMap(uri => api.services.ComponentSetService.getComponentSetFromManifest(uri)),
        Effect.flatMap(api.services.ComponentSetService.ensureNonEmptyComponentSet),
        withPreparationProgress('retrieve', cs => detectConflicts(cs, 'retrieve'))
      );

      // Retrieve is now DATA-ONLY: services builds + retrieves + returns an owned RetrieveOutcome.
      yield* channelService.appendToChannel('Starting metadata retrieval...');
      const outcome = yield* api.services.MetadataRetrieveService.retrieveToSource(spec, { ignoreConflicts: true });
      return yield* retrieveFromOutcome(outcome);
    });

    return yield* performRetrieve.pipe(
      Effect.catchTag('ConflictsDetectedError', err =>
        handleConflictWithRetry({
          pairs: err.pairs,
          operationType: err.operationType,
          // On retry, conflicts were acknowledged — re-run with the same spec (closes over `resolved`).
          retryOperation: performRetrieve
        })
      )
    );
  },
  Effect.catchTag(
    'NoActiveEditorError',
    () => new ManifestSelectionRequiredError({ message: nls.localize('retrieve_select_manifest') })
  ),
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', nls.localize('retrieve_in_manifest_text')))
);
