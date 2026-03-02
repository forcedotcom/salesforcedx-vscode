/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { AllServicesLayer } from './extensionProvider';

/** Promise bridge for imperative code. Ensures trace flags exist for the current target org user. */
export const ensureTraceFlagsForCurrentUser = (): Promise<boolean> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const traceFlagService = yield* api.services.TraceFlagService;
      const userId = yield* traceFlagService.getUserId();
      yield* traceFlagService.ensureTraceFlag(userId);
      return true;
    }).pipe(
      Effect.catchAll(() => Effect.succeed(false)),
      Effect.provide(AllServicesLayer)
    )
  );
