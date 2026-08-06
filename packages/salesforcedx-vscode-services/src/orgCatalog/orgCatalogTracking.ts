/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RemoteTrackingObservation } from './orgCatalogInternalTypes';
import type { OrgMetadataComponentReference } from './orgMetadataReference';
import * as Effect from 'effect/Effect';
import { SourceTrackingService } from '../core/sourceTrackingService';
import { OrgCatalogState } from './orgCatalogState';

export type OrgCatalogTrackingOptions =
  | { readonly local: true; readonly remote?: never }
  | { readonly remote: true; readonly local?: never }
  | { readonly local: true; readonly remote: true };

const identity = (reference: OrgMetadataComponentReference): string => `${reference.xmlName}\0${reference.fullName}`;

export const compareTrackingObservations = (
  previous: ReadonlyMap<string, RemoteTrackingObservation>,
  current: ReadonlyMap<string, RemoteTrackingObservation>
): OrgMetadataComponentReference[] => [
  ...[...new Set([...previous.keys(), ...current.keys()])]
    .filter(key => previous.get(key)?.signature !== current.get(key)?.signature)
    .flatMap(key => {
      const observation = current.get(key) ?? previous.get(key);
      return observation ? [observation.reference] : [];
    })
    .reduce(
      (references, reference) => references.set(identity(reference), reference),
      new Map<string, OrgMetadataComponentReference>()
    )
    .values()
];

export class OrgCatalogTracking extends Effect.Service<OrgCatalogTracking>()('OrgCatalogTracking', {
  accessors: true,
  dependencies: [SourceTrackingService.Default, OrgCatalogState.Default],
  effect: Effect.gen(function* () {
    const [sourceTrackingService, state] = yield* Effect.all([SourceTrackingService, OrgCatalogState]);
    const enrichStatus = <A extends { readonly origin: string; readonly type: string; readonly fullName: string }>(
      orgId: string,
      observedAt: string,
      status: readonly A[]
    ) =>
      status.map(row => ({
        ...row,
        orgId,
        observedAt,
        provenance: 'source-tracking' as const
      }));

    const hasChangeTracking = Effect.fn('OrgCatalogTracking.hasChangeTracking')(function* (orgId: string) {
      return yield* sourceTrackingService.hasTracking(orgId);
    });

    const getChangeStatus = Effect.fn('OrgCatalogTracking.getChangeStatus')(function* (
      orgId: string,
      options: OrgCatalogTrackingOptions
    ) {
      const observedAt = new Date().toISOString();
      return enrichStatus(orgId, observedAt, yield* sourceTrackingService.getStatus(options, orgId));
    });

    const observeChangeStatus = Effect.fn('OrgCatalogTracking.observeChangeStatus')(function* (
      orgId: string,
      options: OrgCatalogTrackingOptions
    ) {
      const observedAt = new Date().toISOString();
      const { remoteChanges, status } = yield* sourceTrackingService.getStatusWithRemoteChanges(options, orgId);
      if (!options.remote) {
        return {
          status: enrichStatus(orgId, observedAt, status),
          observations: undefined,
          changedReferences: []
        };
      }

      const revisionByIdentity = new Map(
        remoteChanges.map(change => [
          `${change.type}\0${change.name}`,
          JSON.stringify([
            change.revisionCounter,
            change.lastModifiedDate,
            change.memberIdOrName,
            change.deleted,
            change.modified
          ])
        ])
      );
      const observations = new Map<string, RemoteTrackingObservation>();
      status
        .filter(row => row.origin === 'remote')
        .forEach(row => {
          const reference = { xmlName: row.type, fullName: row.fullName };
          const key = identity(reference);
          observations.set(key, {
            reference,
            signature: `${row.state}\0${revisionByIdentity.get(key) ?? ''}`
          });
        });
      const previous = yield* state.getTracking(orgId);
      const changedReferences = compareTrackingObservations(previous, observations);
      yield* Effect.annotateCurrentSpan({
        changedRemoteComponentCount: changedReferences.length,
        remoteStatusRows: observations.size
      });
      return {
        status: enrichStatus(orgId, observedAt, status),
        observations,
        changedReferences
      };
    });

    const commitObservations = Effect.fn('OrgCatalogTracking.commitObservations')(function* (
      orgId: string,
      observations: ReadonlyMap<string, RemoteTrackingObservation>
    ) {
      yield* state.setTracking(orgId, observations);
    });

    return { commitObservations, getChangeStatus, hasChangeTracking, observeChangeStatus } as const;
  })
}) {}
