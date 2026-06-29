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
import { ApexTestDiscoveryService } from '../discoveryVfs/apexTestDiscoveryService';
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
        (isString(orgId)
          ? channelService.appendToChannel(`Discovering tests for org: ${orgId}`).pipe(
              Effect.zipRight(Effect.promise(() => testController.refresh())),
              // Drop other orgs' discovered classes so the in-memory VFS holds only the current org's tree.
              Effect.zipRight(ApexTestDiscoveryService.pruneForeignOrgClasses(orgId))
            )
          : // No org: clear tree + tabs + VFS. Also fires on activation (Stream.changes emits element-0),
            // intentionally purging stale prior-session state before any login.
            Effect.promise(() => testController.clearAllTestItems()).pipe(
              Effect.zipRight(Effect.promise(() => testController.closeAllApexTestingTabs())),
              Effect.zipRight(ApexTestDiscoveryService.clearAll())
            )
        ).pipe(
          // Swallow VFS-clear failures (scoped tag, logged) so they don't kill the reactor.
          Effect.catchTag('DiscoveryClearError', error =>
            Effect.logDebug('Apex Testing: discovery VFS clear failed').pipe(
              Effect.annotateLogs({ orgKey: error.orgKey, scheme: 'apex-testing' })
            )
          ),
          Effect.catchAll(error => {
            console.debug('[Apex Testing] Test discovery setup failed:', error);
            return Effect.void;
          })
        )
      )
    )
  );
});
