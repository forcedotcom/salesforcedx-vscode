/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { AllServicesLayer } from '../services/extensionProvider';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

/** Deploy local changes to the default org */
export const projectDeployStart = (ignoreConflicts = false) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSet = yield* (yield* api.services.ComponentSetService).ensureNonEmptyComponentSet(
      yield* api.services.MetadataDeployService.getComponentSetForDeploy({ ignoreConflicts })
    );

    yield* deployComponentSet({ componentSet });
  }).pipe(Effect.withSpan('projectDeployStart', { attributes: { ignoreConflicts } }), Effect.provide(AllServicesLayer));
