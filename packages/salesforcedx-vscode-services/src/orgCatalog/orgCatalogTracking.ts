/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RemoteTrackingObservation } from './orgCatalogInternalTypes';
import type { makeOrgCatalogState } from './orgCatalogState';
import type { OrgMetadataComponentReference } from './orgMetadataReference';
import type { SourceTrackingService } from '../core/sourceTrackingService';
import * as Effect from 'effect/Effect';

export type OrgCatalogTrackingOptions =
  | { readonly local: true; readonly remote?: never }
  | { readonly remote: true; readonly local?: never }
  | { readonly local: true; readonly remote: true };

type OrgCatalogTrackingFactoryOptions = {
  readonly sourceTrackingService: InstanceType<typeof SourceTrackingService>;
  readonly state: Effect.Effect.Success<ReturnType<typeof makeOrgCatalogState>>;
};

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

export const makeOrgCatalogTracking = ({ sourceTrackingService, state }: OrgCatalogTrackingFactoryOptions) => {
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

  const hasChangeTracking = Effect.fn('OrgCatalogTracking.hasChangeTracking')(function* () {
    return yield* sourceTrackingService.hasTracking();
  });

  const getChangeStatus = Effect.fn('OrgCatalogTracking.getChangeStatus')(function* (
    orgId: string,
    options: OrgCatalogTrackingOptions
  ) {
    const observedAt = new Date().toISOString();
    return enrichStatus(orgId, observedAt, yield* sourceTrackingService.getStatus(options));
  });

  const observeChangeStatus = Effect.fn('OrgCatalogTracking.observeChangeStatus')(function* (
    orgId: string,
    options: OrgCatalogTrackingOptions
  ) {
    const observedAt = new Date().toISOString();
    const { remoteChanges, status } = yield* sourceTrackingService.getStatusWithRemoteChanges(options);
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
};
