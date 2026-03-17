/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { handleConflictWithRetry } from '../conflict/conflictFlow';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

const deployEffect = Effect.fn('projectDeploy.deployEffect')(function* (ignoreConflicts: boolean) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const componentSet = yield* (yield* api.services.ComponentSetService).ensureNonEmptyComponentSet(
    yield* api.services.MetadataDeployService.getComponentSetForDeploy({ ignoreConflicts })
  );
  yield* deployComponentSet({ componentSet });
});

/** Deploy local changes to the default org */
export const projectDeployStartCommand = (ignoreConflicts = false) =>
  deployEffect(ignoreConflicts).pipe(
    Effect.catchTag('SourceTrackingConflictError', () =>
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const componentSet = yield* (yield* api.services.ComponentSetService).ensureNonEmptyComponentSet(
          yield* api.services.MetadataDeployService.getComponentSetForDeploy({ ignoreConflicts: true })
        );
        return yield* handleConflictWithRetry({
          retryOperation: deployEffect(true),
          operationType: 'deploy',
          componentSet
        });
      })
    )
  );
