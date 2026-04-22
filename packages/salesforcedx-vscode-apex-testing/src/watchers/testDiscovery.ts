/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { getTestController } from '../views/testController';

/** Initialize test discovery when an org is available, and re-discover on org changes */
export const initializeTestDiscovery = Effect.fn('apex-testing.initializeTestDiscovery')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const channelService = yield* api.services.ChannelService;
  // Subscribe to org changes and re-discover tests when org changes
  yield* Effect.forkDaemon(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.filter(isString),
      Stream.changes,
      Stream.tap(orgId => channelService.appendToChannel(`Discovering tests for org: ${orgId}`)),
      Stream.runForEach(() =>
        Effect.promise(() => testController.discoverTests()).pipe(
          Effect.catchAll(error => {
            console.debug('[Apex Testing] Test discovery setup failed:', error);
            return Effect.void;
          })
        )
      )
    )
  );
});
