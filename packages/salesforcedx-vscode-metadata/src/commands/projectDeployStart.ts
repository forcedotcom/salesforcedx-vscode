/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

/** Deploy local changes to the default org */
export const projectDeployStartCommand = (ignoreConflicts = false) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [componentSetService] = yield* Effect.all([api.services.ComponentSetService], { concurrency: 'unbounded' });
    const componentSet = yield* api.services.MetadataDeployService.getComponentSetForDeploy({ ignoreConflicts });

    const nonEmpty = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
    yield* deployComponentSet({ componentSet: nonEmpty });
  }).pipe(
    Effect.catchTag('EmptyComponentSetError', () =>
      Effect.sync(() => {
        void vscode.window.showInformationMessage(nls.localize('no_local_changes_to_deploy'));
      })
    )
  );
