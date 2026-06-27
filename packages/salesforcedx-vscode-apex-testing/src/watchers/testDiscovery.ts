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
          : // No org: clear the tree, close the now-stale virtual editor tabs, then purge the VFS orgs root so a
            // later login to another org shows no stale classes. `Stream.changes` emits the current value as
            // element-0, so this also fires on activation when no default org is set yet — that startup purge is
            // intentional: it removes any stale tabs/VFS state left over from a previous session before a login.
            Effect.promise(() => testController.clearAllTestItems()).pipe(
              Effect.zipRight(Effect.promise(() => testController.closeAllApexTestingTabs())),
              Effect.zipRight(ApexTestDiscoveryService.clearAll())
            )
        ).pipe(
          // The only typed failure here is a VFS clear (pruneForeignOrgClasses / clearAll). A failed purge
          // must not break the org-change reactor, so ignore it intentionally — but scoped to that one tag
          // and structured-logged, never a blanket catchAll.
          Effect.catchTag('DiscoveryClearError', error =>
            Effect.logDebug('Apex Testing: discovery VFS clear failed').pipe(
              Effect.annotateLogs({ orgKey: error.orgKey, scheme: 'apex-testing' })
            )
          )
        )
      )
    )
  );
});
