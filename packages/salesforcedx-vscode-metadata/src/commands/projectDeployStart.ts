/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

/** Deploy local changes to the default org */
export const projectDeployStart = async (ignoreConflicts = false) =>
  Effect.runPromise(projectDeployStartEffect(ignoreConflicts).pipe(Effect.provide(AllServicesLayer)));

const projectDeployStartEffect = (ignoreConflicts: boolean) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ ignoreConflicts });

    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const deployService = yield* api.services.MetadataDeployService;
    const componentSetUnvalidated = yield* deployService.getComponentSetForDeploy({ ignoreConflicts });
    const componentSet = yield* deployService.ensureNonEmptyComponentSet(componentSetUnvalidated);

    yield* deployComponentSet({ componentSet });
  }).pipe(Effect.withSpan('projectDeployStart', { attributes: { ignoreConflicts } }), Effect.provide(AllServicesLayer));
