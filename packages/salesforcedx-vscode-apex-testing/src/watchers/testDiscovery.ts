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
import { closeForeignApexTestingTabs, getTestController } from '../views/testController';

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
          ? // Re-discovery (tree refresh) is independent of the stale-state cleanup, so run them
            // concurrently. Within cleanup, close tabs BEFORE pruning their backing VFS files — closing a
            // tab whose file was already deleted leaves a dead "deleted file" editor instead of closing it.
            Effect.all(
              [
                channelService
                  .appendToChannel(`Discovering tests for org: ${orgId}`)
                  .pipe(Effect.tap(() => Effect.promise(() => testController.refresh()))),
                closeForeignApexTestingTabs(orgId).pipe(
                  Effect.tap(() => ApexTestDiscoveryService.pruneForeignOrgClasses(orgId))
                )
              ],
              { concurrency: 'unbounded', discard: true }
            )
          : // No org: clear tree + tabs + VFS. Also fires on activation (Stream.changes emits element-0),
            // intentionally purging stale prior-session state before any login. Undefined orgKey => every
            // apex-testing: org tab is foreign, so this closes them all. Tree-clear is independent of the
            // tab/VFS cleanup; close before clearAll for the same dead-editor reason as above.
            Effect.all(
              [
                Effect.promise(() => testController.clearAllTestItems()),
                closeForeignApexTestingTabs(undefined).pipe(Effect.tap(() => ApexTestDiscoveryService.clearAll()))
              ],
              { concurrency: 'unbounded', discard: true }
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
