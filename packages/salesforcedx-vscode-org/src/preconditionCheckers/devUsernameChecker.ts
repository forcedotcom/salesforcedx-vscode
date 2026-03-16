/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { getTargetDevHubOrAlias } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { getOrgRuntime } from '../extensionProvider';

const getTargetDevHub = Effect.fn('checkDevHubConfigured.getTargetDevHub')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConfigService.getTargetDevHub();
});

/** Returns true if a Dev Hub is configured. Shows "no dev hub" warning and returns false otherwise. */
export const checkDevHubConfigured = async (): Promise<boolean> => {
  const targetDevHubOrAlias = await getOrgRuntime().runPromise(
    getTargetDevHub().pipe(Effect.orElse(() => Effect.promise(() => getTargetDevHubOrAlias(false))))
  );
  if (!targetDevHubOrAlias) {
    void getTargetDevHubOrAlias(true); // show the "no dev hub" warning to the user
    return false;
  }
  return true;
};
