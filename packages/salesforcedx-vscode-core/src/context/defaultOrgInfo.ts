/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

/**
 * Reads the cached DefaultOrgInfo from the services-extension `TargetOrgRef`.
 * Centralizes the `ExtensionProviderService -> services.TargetOrgRef -> SubscriptionRef.get` pattern
 * so callers don't repeat it.
 */
export const getDefaultOrgInfo = Effect.fn('context.getDefaultOrgInfo')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  return yield* SubscriptionRef.get(ref);
});
