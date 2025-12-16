/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { nls } from '../../messages';
import { AllServicesLayer, ExtensionProviderService } from '../../services/extensionProvider';
import { deployComponentSet } from '../deployComponentSet';

/** Deploy local changes to the default org */
export const projectDeployStart = async (ignoreConflicts = false): Promise<void> =>
  Effect.runPromise(projectDeployStartEffect(ignoreConflicts).pipe(Effect.provide(AllServicesLayer)));

const projectDeployStartEffect = Effect.fn('projectDeployStart')(function* (ignoreConflicts: boolean) {
  yield* Effect.annotateCurrentSpan({ ignoreConflicts });

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const deployService = yield* api.services.MetadataDeployService;
  const componentSet = yield* deployService.getComponentSetForDeploy({ ignoreConflicts });

  yield* deployComponentSet({ componentSet, emptyMessage: nls.localize('deploy_no_local_changes_message') });
});
