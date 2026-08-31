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
import { messages } from '../messages/i18n';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { withPreparationProgress } from '../utils/withPreparationProgress';
import { ManifestSelectionRequiredError } from './manifestErrors';

const COMMAND: ProgressAndSuccessCommandKey = messages.deploy_in_manifest_text;

/** Deploy to the default org using a manifest file */
export const deployManifestCommand = Effect.fn('deployManifestCommand')(
  function* (manifestUri?: URI) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const notificationMode = yield* api.services.NotificationModeService;
    const resolved = manifestUri ?? (yield* api.services.EditorService.getActiveEditorUri());

    yield* Effect.succeed(resolved).pipe(
      Effect.flatMap(uri => api.services.ComponentSetService.getComponentSetFromManifest(uri)),
      Effect.flatMap(api.services.ComponentSetService.ensureNonEmptyComponentSet),
      withPreparationProgress('deploy', cs => detectConflicts(cs, 'deploy'), COMMAND),
      Effect.flatMap(cs => deployComponentSet({ componentSet: cs, command: COMMAND })),
      Effect.catchTag('ConflictsDetectedError', err =>
        handleConflictWithRetry({
          pairs: err.pairs,
          operationType: err.operationType,
          retryOperation: deployComponentSet({
            componentSet: err.componentSet,
            expectedOrgId: err.orgId,
            command: COMMAND
          })
        })
      )
    );
    yield* notificationMode.showSuccessNotification(
      COMMAND,
      nls.localize('command_succeeded_text', nls.localize('deploy_in_manifest_text'))
    );
  },
  Effect.catchTag(
    'NoActiveEditorError',
    () => new ManifestSelectionRequiredError({ message: nls.localize('deploy_select_manifest') })
  )
);
