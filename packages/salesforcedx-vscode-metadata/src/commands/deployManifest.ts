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
import { deployFromOutcome } from '../shared/deploy/deployFromOutcome';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';
import { withPreparationProgress } from '../utils/withPreparationProgress';
import { ManifestSelectionRequiredError } from './manifestErrors';

export const deployManifestCommand = Effect.fn('deployManifestCommand')(
  function* (manifestUri?: URI) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    const resolved = manifestUri ?? (yield* api.services.EditorService.getActiveEditorUri());
    const spec = { kind: 'manifest' as const, manifestUri: resolved.toString() };

    // Helper that performs the deploy. Closes over resolved URI so retry can re-use it.
    const performDeploy = Effect.gen(function* () {
      // Conflict detection stays on the existing ComponentSet path (deferred migration).
      yield* Effect.succeed(resolved).pipe(
        Effect.flatMap(uri => api.services.ComponentSetService.getComponentSetFromManifest(uri)),
        Effect.flatMap(api.services.ComponentSetService.ensureNonEmptyComponentSet),
        withPreparationProgress('deploy', cs => detectConflicts(cs, 'deploy'))
      );

      // Deploy is now DATA-ONLY: services builds + deploys + returns an owned DeployOutcome.
      yield* channelService.appendToChannel('Starting metadata deployment...');
      const outcome = yield* api.services.MetadataDeployService.deployFromSource(spec, { ignoreConflicts: true });
      return yield* deployFromOutcome(outcome);
    });

    return yield* performDeploy.pipe(
      Effect.catchTag('ConflictsDetectedError', err =>
        handleConflictWithRetry({
          pairs: err.pairs,
          operationType: err.operationType,
          // On retry, conflicts were acknowledged — re-run with the same spec (closes over `resolved`).
          retryOperation: performDeploy
        })
      )
    );
  },
  Effect.catchTag(
    'NoActiveEditorError',
    () => new ManifestSelectionRequiredError({ message: nls.localize('deploy_select_manifest') })
  ),
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', nls.localize('deploy_in_manifest_text')))
);
