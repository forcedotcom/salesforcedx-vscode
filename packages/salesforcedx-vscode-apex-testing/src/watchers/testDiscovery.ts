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
import type { OrgMetadataCatalogChange } from 'salesforcedx-vscode-services';
import { getTestController } from '../views/testController';

/** Initialize test discovery when an org is available, and clear/re-discover on org changes. */
export const initializeTestDiscovery = Effect.fn('apex-testing.initializeTestDiscovery')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const channelService = yield* api.services.ChannelService;
  const catalogChanges = yield* api.services.OrgMetadataCatalogChangePubSub;
  yield* Effect.all(
    [
      Effect.forkDaemon(
        targetOrgRef.changes.pipe(
          Stream.map(org => org.orgId),
          Stream.changes,
          Stream.runForEach(orgId =>
            isString(orgId)
              ? channelService
                  .appendToChannel(`Discovering tests for org: ${orgId}`)
                  .pipe(Effect.tap(() => Effect.promise(() => testController.refresh())))
              : Effect.promise(() => testController.clearAllTestItems())
          )
        )
      ),
      Effect.forkDaemon(
        catalogChanges.pipe(
          Stream.fromPubSub<OrgMetadataCatalogChange>,
          Stream.filter(
            change =>
              change.kind === 'workspace' &&
              (change.event.type === 'create' || change.event.type === 'delete') &&
              change.event.uri.path.toLowerCase().endsWith('.cls')
          ),
          Stream.runForEach(() => Effect.promise(() => testController.refresh()))
        )
      )
    ],
    { discard: true }
  );
});
