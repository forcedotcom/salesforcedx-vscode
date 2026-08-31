/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { preventOrgChanges } from '../services/extensionProvider';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { withPreparationProgress } from '../utils/withPreparationProgress';

const COMMAND: ProgressAndSuccessCommandKey = messages.project_deploy_start_default_org_text;

const deployEffect = Effect.fn('projectDeploy.deployEffect')(function* (ignoreConflicts: boolean) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.MetadataDeployService.getComponentSetForDeploy().pipe(
    Effect.flatMap((yield* api.services.ComponentSetService).ensureNonEmptyComponentSet),
    withPreparationProgress('deploy', ignoreConflicts ? undefined : cs => detectConflicts(cs, 'deploy'), COMMAND),
    Effect.flatMap(cs => deployComponentSet({ componentSet: cs, command: COMMAND }))
  );
});

/** Deploy local changes to the default org */
export const projectDeployStartCommand = Effect.fn('projectDeployStartCommand')(function* (ignoreConflicts = false) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.services.NotificationModeService;
  return yield* deployEffect(ignoreConflicts).pipe(
    Effect.catchTag('ConflictsDetectedError', err =>
      handleConflictWithRetry({
        pairs: err.pairs,
        operationType: err.operationType,
        retryOperation: deployEffect(true)
      })
    ),
    Effect.tap(() =>
      notificationMode.showSuccessNotification(
        COMMAND,
        nls.localize(
          'command_succeeded_text',
          ignoreConflicts
            ? nls.localize('project_deploy_start_ignore_conflicts_default_org_text')
            : nls.localize('project_deploy_start_default_org_text')
        )
      )
    ),
    Effect.catchTag('EmptyComponentSetError', () =>
      notificationMode.showSuccessNotification(COMMAND, nls.localize('no_local_changes_to_deploy'))
    )
  );
}, preventOrgChanges);
