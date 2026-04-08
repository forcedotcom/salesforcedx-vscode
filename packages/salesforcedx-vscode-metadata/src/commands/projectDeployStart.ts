/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';

const deployEffect = Effect.fn('projectDeploy.deployEffect')(function* (ignoreConflicts: boolean) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.MetadataDeployService.getComponentSetForDeploy().pipe(
    Effect.flatMap((yield* api.services.ComponentSetService).ensureNonEmptyComponentSet),
    Effect.tap(cs => (ignoreConflicts ? Effect.void : detectConflicts(cs, 'deploy'))),
    Effect.flatMap(cs => deployComponentSet({ componentSet: cs }))
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
    ),
    Effect.catchTag('ConflictsDetectedError', err =>
      handleConflictWithRetry({
        pairs: err.pairs,
        operationType: err.operationType,
        retryOperation: deployEffect(true)
      })
    )
  );
