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
import { type URI, Utils } from 'vscode-uri';
import { getTestController } from '../views/testController';

const apexClassName = (uri: URI): string | undefined => {
  const basename = Utils.basename(uri);
  const lower = basename.toLowerCase();
  if (lower.endsWith('.cls-meta.xml')) return basename.slice(0, -'.cls-meta.xml'.length);
  if (lower.endsWith('.cls')) return basename.slice(0, -'.cls'.length);
  return undefined;
};

const toApexClassChanges = (change: Extract<OrgMetadataCatalogChange, { kind: 'workspace' }>): Map<string, string> =>
  new Map(
    change.events
      .filter(event => event.type === 'create' || event.type === 'delete')
      .flatMap(event => {
        const className = apexClassName(event.uri);
        return className ? [[className, 'workspacePresence'] as const] : [];
      })
  );

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
            (change): change is Extract<OrgMetadataCatalogChange, { kind: 'workspace' }> => change.kind === 'workspace'
          ),
          Stream.map(toApexClassChanges),
          Stream.filter(changes => changes.size > 0),
          Stream.runForEach(changes => Effect.promise(() => testController.incrementalUpdate(changes, false)))
        )
      )
    ],
    { discard: true }
  );
});
