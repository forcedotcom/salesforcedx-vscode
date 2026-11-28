/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, TargetOrgRef, type OrgId } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { makeScopedFibers } from '../scopedFiber.js';
import { OrgCatalogState } from './orgCatalogState.js';

export const flushPreviousOrgOnChanges = <E, R>(
  orgIds: Stream.Stream<OrgId | undefined>,
  flushOrg: (orgId: OrgId) => Effect.Effect<void, E, R>,
  appendToChannel: (message: string) => Effect.Effect<void, E, R>
) =>
  orgIds.pipe(
    Stream.changes,
    Stream.zipWithPrevious,
    Stream.runForEach(([previousOrgIdOption, newOrgId]) =>
      Effect.gen(function* () {
        const previousOrgId = Option.getOrUndefined(previousOrgIdOption);
        yield* appendToChannel(
          `Target org changed to ${newOrgId ?? '<NOT SET>'}${previousOrgId ? `; closing previous org ${previousOrgId}` : ''}`
        );
        if (previousOrgId !== undefined && previousOrgId !== newOrgId) {
          yield* Effect.gen(function* () {
            yield* Effect.logInfo('Closing org catalog', { orgId: previousOrgId });
            yield* flushOrg(previousOrgId);
            yield* Effect.annotateCurrentSpan({ orgId: previousOrgId });
            yield* Effect.logDebug('Org catalog closed', { orgId: previousOrgId });
          }).pipe(Effect.withSpan('OrgMetadataCatalog.closeOrg'));
        }
      })
    )
  );

/** Flush the previous org's catalog before the active org changes its writer. */
export const OrgCatalogCloseWatcherLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fibers = yield* makeScopedFibers;
    const catalogState = yield* OrgCatalogState;
    const orgRef = yield* TargetOrgRef;
    const channel = yield* ChannelService;
    yield* flushPreviousOrgOnChanges(
      SubscriptionRef.changes(orgRef).pipe(Stream.map(org => org.orgId)),
      orgId => catalogState.flushOrg(orgId).pipe(Effect.asVoid),
      message => channel.appendToChannel(message)
    ).pipe(fibers.fork);
  })
);
