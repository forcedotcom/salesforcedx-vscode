/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { getTargetDevHubOrAlias, type PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { AllServicesLayer } from '../extensionProvider';

const getTargetDevHub = Effect.fn('DevUsernameChecker.getTargetDevHub')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConfigService.getTargetDevHub();
});

/** Checks if a Dev Hub is configured */
export class DevUsernameChecker implements PreconditionChecker {
  public async check(): Promise<boolean> {
    const targetDevHubOrAlias = await getTargetDevHub().pipe(
      Effect.provide(AllServicesLayer),
      Effect.orElse(() => Effect.promise(() => getTargetDevHubOrAlias(false))),
      Effect.runPromise
    );
    if (!targetDevHubOrAlias) {
      void getTargetDevHubOrAlias(true); // show the "no dev hub" warning to the user
      return false;
    }

    return true;
  }
}
