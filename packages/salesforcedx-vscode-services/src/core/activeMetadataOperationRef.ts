/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

// eslint-disable-next-line functional/no-let
let activeMetadataOperationRef: SubscriptionRef.SubscriptionRef<number> | undefined;

export const getActiveMetadataOperationRef = () =>
  Effect.gen(function* () {
    activeMetadataOperationRef ??= yield* SubscriptionRef.make(0);
    return activeMetadataOperationRef;
  });

export const withActiveMetadataOperationPipeline = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  getActiveMetadataOperationRef().pipe(
    Effect.flatMap(ref =>
      Effect.acquireUseRelease(
        SubscriptionRef.update(ref, n => n + 1),
        () => effect,
        () => SubscriptionRef.update(ref, n => Math.max(0, n - 1))
      )
    )
  );
