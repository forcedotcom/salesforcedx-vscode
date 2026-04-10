/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

/** Wrap an effect so the active-metadata-operation counter is incremented while it runs.
 * This signals the status bar to suppress polling during the wrapped operation. */
export const withActiveMetadataOperation = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const ref = yield* api.services.ActiveMetadataOperationRef();
    return yield* Effect.acquireUseRelease(
      SubscriptionRef.update(ref, n => n + 1),
      () => effect,
      () => SubscriptionRef.update(ref, n => Math.max(0, n - 1))
    );
  });
