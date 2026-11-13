/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { type URI } from 'vscode-uri';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { preventOrgChanges } from '../services/extensionProvider';
import { retrieveComponentSet } from '../shared/retrieve/retrieveComponentSet';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { withPreparationProgress } from '../utils/withPreparationProgress';
import { ManifestSelectionRequiredError } from './manifestErrors';

const COMMAND: ProgressAndSuccessCommandKey = messages.retrieve_in_manifest_text;

/** Retrieve from the default org using a manifest file */
export const retrieveManifestCommand = Effect.fn('retrieveManifestCommand')(
  function* (manifestUri: URI | undefined) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const notificationMode = yield* api.v2.services.NotificationModeService;
    const componentSetService = yield* api.v2.services.ComponentSetService;
    const resolved = manifestUri ?? (yield* api.v2.services.EditorService.use(service => service.getActiveEditorUri()));

    yield* Effect.succeed(resolved).pipe(
      Effect.flatMap(uri => componentSetService.getComponentSetFromManifest(uri)),
      Effect.flatMap(componentSetService.ensureNonEmptyComponentSet),
      withPreparationProgress('retrieve', cs => detectConflicts(cs, 'retrieve'), COMMAND),
      Effect.flatMap(cs => retrieveComponentSet({ componentSet: cs, ignoreConflicts: true, command: COMMAND })),
      Effect.catchTag('ConflictsDetectedError', err =>
        handleConflictWithRetry({
          pairs: err.pairs,
          operationType: err.operationType,
          retryOperation: retrieveComponentSet({
            componentSet: err.componentSet,
            ignoreConflicts: true,
            command: COMMAND
          })
        })
      )
    );
    yield* notificationMode.showSuccessNotification(
      COMMAND,
      nls.localize('command_succeeded_text', nls.localize('retrieve_in_manifest_text'))
    );
  },
  Effect.catchTag(
    'NoActiveEditorError',
    () => new ManifestSelectionRequiredError({ message: nls.localize('retrieve_select_manifest') })
  ),
  preventOrgChanges
);
