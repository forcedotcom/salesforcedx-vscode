/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { deployFromOutcome } from '../shared/deploy/deployFromOutcome';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';
import { withPreparationProgress } from '../utils/withPreparationProgress';

const deployEffect = Effect.fn('projectDeploy.deployEffect')(function* (ignoreConflicts: boolean) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const spec = { kind: 'projectDirectories' as const };

  // The data-only deploy. This is the RETRY target — it must NOT re-run conflict detection.
  const performDeploy = Effect.gen(function* () {
    yield* channelService.appendToChannel('Starting metadata deployment...');
    const outcome = yield* api.services.MetadataDeployService.deployFromSource(spec, { ignoreConflicts: true });
    return yield* deployFromOutcome(outcome);
  });

  // Conflict detection runs ONCE (on the existing ComponentSet path — deferred migration).
  // When ignoreConflicts is true, skip detection entirely; when false, detect once and retry detection-free.
  // If conflicts are acknowledged via the modal, retry performs the deploy WITHOUT re-detecting.
  if (ignoreConflicts) {
    return yield* performDeploy;
  }

  return yield* api.services.MetadataDeployService.getComponentSetForDeploy().pipe(
    Effect.flatMap((yield* api.services.ComponentSetService).ensureNonEmptyComponentSet),
    withPreparationProgress('deploy', cs => detectConflicts(cs, 'deploy')),
    Effect.flatMap(() => performDeploy),
    Effect.catchTag('ConflictsDetectedError', err =>
      handleConflictWithRetry({
        pairs: err.pairs,
        operationType: err.operationType,
        retryOperation: performDeploy
      })
    )
  );
});

/** Deploy local changes to the default org */
export const projectDeployStartCommand = (ignoreConflicts = false) =>
  deployEffect(ignoreConflicts).pipe(
    withConfigurableSuccessNotification(
      nls.localize(
        'command_succeeded_text',
        ignoreConflicts
          ? nls.localize('project_deploy_start_ignore_conflicts_default_org_text')
          : nls.localize('project_deploy_start_default_org_text')
      )
    ),
    Effect.catchTag('EmptyComponentSetError', () =>
      Effect.sync(() => {
        void vscode.window.showInformationMessage(nls.localize('no_local_changes_to_deploy'));
      })
    )
  );
