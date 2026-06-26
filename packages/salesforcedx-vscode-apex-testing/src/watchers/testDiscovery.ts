/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { getTestController } from '../views/testController';

/** Initialize test discovery when an org is available, and clear/re-discover on org changes */
export const initializeTestDiscovery = Effect.fn('apex-testing.initializeTestDiscovery')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const channelService = yield* api.services.ChannelService;
  // Subscribe to org changes: discover tests when an org is available, clear the tree when it goes away (logout/delete)
  yield* Effect.forkDaemon(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.runForEach(orgId =>
        isString(orgId)
          ? channelService
              .appendToChannel(`Discovering tests for org: ${orgId}`)
              .pipe(Effect.zipRight(Effect.tryPromise(() => testController.refresh())))
          : Effect.tryPromise(() => testController.clearAllTestItems())
      ),
      Effect.catchAll(error => Effect.log('[Apex Testing] Test discovery setup failed', { error }))
    )
  );
});
