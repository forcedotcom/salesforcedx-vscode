/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ListedMetadataComponent, RemoteTrackingObservation } from './orgCatalogInternalTypes';
import type { OrgSObjectDescription, OrgSObjectSummary } from './orgMetadataCatalogTypes';
import type { OrgMetadataComponentReference } from './orgMetadataReference';
import type { MetadataOperationEvent } from '../core/metadataChangeNotificationService';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import { TransmogrifierService, type DescribeSObjectResult } from '../core/transmogrifierService';
import { componentIdentity } from './orgCatalogKeys';
import { OrgCatalogState } from './orgCatalogState';
import { OrgMetadataCatalogChangePubSub } from './orgMetadataCatalogChangePubSub';

type MetadataTypeResult = {
  readonly xmlName: string;
  readonly directoryName: string;
  readonly suffix?: string | null;
  readonly folderContentType?: string | null;
  readonly inFolder?: boolean;
  readonly metaFile?: boolean;
  readonly childXmlNames?: readonly string[];
};

type TrackingStatusRow = {
  readonly origin: string;
  readonly type: string;
  readonly fullName: string;
  readonly state: string;
};

type TrackingRemoteChange = {
  readonly type: string;
  readonly name: string;
  readonly revisionCounter?: number;
  readonly lastModifiedDate?: string;
  readonly memberIdOrName?: string;
  readonly deleted?: boolean;
  readonly modified?: boolean;
};

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
      (references, reference) => references.set(componentIdentity(reference), reference),
      new Map<string, OrgMetadataComponentReference>()
    )
    .values()
];

const componentObservation = (component: ListedMetadataComponent): ListedMetadataComponent => ({
  fullName: component.fullName,
  ...(component.namespacePrefix ? { namespacePrefix: component.namespacePrefix } : {}),
  ...(component.manageableState ? { manageableState: component.manageableState } : {}),
  ...(component.fileName ? { fileName: component.fileName } : {}),
  ...(component.lastModifiedByName ? { lastModifiedByName: component.lastModifiedByName } : {}),
  ...(component.lastModifiedDate ? { lastModifiedDate: component.lastModifiedDate } : {})
});

/** Private write boundary used by metadata-producing services. */
export class OrgMetadataCatalogRecorder extends Effect.Service<OrgMetadataCatalogRecorder>()(
  'OrgMetadataCatalogRecorder',
  {
    accessors: true,
    dependencies: [OrgCatalogState.Default, OrgMetadataCatalogChangePubSub.Default, TransmogrifierService.Default],
    effect: Effect.gen(function* () {
      const [state, catalogChanges, transmogrifier] = yield* Effect.all([
        OrgCatalogState,
        OrgMetadataCatalogChangePubSub,
        TransmogrifierService
      ]);

      const recordMetadataTypes = Effect.fn('OrgMetadataCatalogRecorder.recordMetadataTypes')(function* (
        orgId: string,
        metadataTypes: readonly MetadataTypeResult[]
      ) {
        yield* state.ensureHydrated(orgId);
        const previous = yield* state.getMetadataTypes(orgId);
        const normalized = metadataTypes
          .map(type => ({
            xmlName: type.xmlName,
            directoryName: type.directoryName,
            ...(type.suffix ? { suffix: type.suffix } : {}),
            ...(type.folderContentType ? { folderContentType: type.folderContentType } : {}),
            inFolder: type.inFolder ?? false,
            metaFile: type.metaFile ?? false,
            childXmlNames: [...(type.childXmlNames ?? [])].toSorted(),
            observedAt: ''
          }))
          .toSorted((left, right) => left.xmlName.localeCompare(right.xmlName));
        const previousComparable = previous?.map(type => ({ ...type, observedAt: '' }));
        const changed = JSON.stringify(previousComparable) !== JSON.stringify(normalized);
        if (changed) {
          const observedAt = new Date().toISOString();
          yield* state.setMetadataTypes(
            orgId,
            normalized.map(type => ({ ...type, observedAt }))
          );
          yield* state.queuePersist(orgId);
        }
        yield* Effect.annotateCurrentSpan({ orgId, observationCount: normalized.length, changed });
      });

      const recordMetadataListing = Effect.fn('OrgMetadataCatalogRecorder.recordMetadataListing')(function* (
        orgId: string,
        xmlName: string,
        folder: string | undefined,
        components: readonly ListedMetadataComponent[]
      ) {
        yield* state.ensureHydrated(orgId);
        const previous = yield* state.getMetadataListing(orgId, xmlName, folder);
        const normalized = components
          .map(componentObservation)
          .toSorted((left, right) => left.fullName.localeCompare(right.fullName));
        const changed = JSON.stringify(previous?.components) !== JSON.stringify(normalized);
        if (changed) {
          yield* state.setMetadataListing(orgId, {
            xmlName,
            ...(folder ? { folder } : {}),
            observedAt: new Date().toISOString(),
            components: normalized
          });
          yield* state.queuePersist(orgId);
        }
        yield* Effect.annotateCurrentSpan({ orgId, xmlName, folder, observationCount: normalized.length, changed });
      });

      const recordSObjectList = Effect.fn('OrgMetadataCatalogRecorder.recordSObjectList')(function* (
        orgId: string,
        sobjects: readonly { readonly name: string; readonly custom: boolean; readonly queryable: boolean }[]
      ) {
        yield* state.ensureHydrated(orgId);
        const previous = yield* state.getSObjectList(orgId);
        const comparable = sobjects
          .map(sobject => ({
            name: sobject.name,
            custom: sobject.custom,
            queryable: sobject.queryable
          }))
          .toSorted((left, right) => left.name.localeCompare(right.name));
        const previousComparable = previous?.map(({ name, custom, queryable }) => ({ name, custom, queryable }));
        const changed = JSON.stringify(previousComparable) !== JSON.stringify(comparable);
        if (changed) {
          const observedAt = new Date().toISOString();
          const observations: readonly OrgSObjectSummary[] = comparable.map(sobject => ({
            ...sobject,
            orgId,
            observedAt,
            provenance: 'rest-api'
          }));
          yield* state.setSObjectList(orgId, observations);
          yield* state.queuePersist(orgId);
        }
        yield* Effect.annotateCurrentSpan({ orgId, observationCount: comparable.length, changed });
      });

      const recordSObjectDescription = Effect.fn('OrgMetadataCatalogRecorder.recordSObjectDescription')(function* (
        orgId: string,
        raw: DescribeSObjectResult
      ) {
        yield* state.ensureHydrated(orgId);
        const sobject = yield* transmogrifier.toMinimalSObject(raw);
        const previous = yield* state.getSObjectDescription(orgId, sobject.name);
        const previousComparable = previous
          ? Object.fromEntries(
              Object.entries(previous).filter(
                ([key]) => !['orgId', 'observedAt', 'provenance', 'remoteLastModifiedDate'].includes(key)
              )
            )
          : undefined;
        const changed = JSON.stringify(previousComparable) !== JSON.stringify(sobject);
        if (changed) {
          const observation: OrgSObjectDescription = {
            ...sobject,
            orgId,
            observedAt: new Date().toISOString(),
            provenance: 'rest-api'
          };
          yield* state.setSObjectDescription(orgId, observation);
          yield* state.queuePersist(orgId);
        }
        yield* Effect.annotateCurrentSpan({ orgId, objectName: sobject.name, changed });
      });

      const recordTrackingStatus = Effect.fn('OrgMetadataCatalogRecorder.recordTrackingStatus')(function* (
        orgId: string,
        status: readonly TrackingStatusRow[],
        remoteChanges: readonly TrackingRemoteChange[]
      ) {
        yield* state.ensureHydrated(orgId);
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
            const key = componentIdentity(reference);
            observations.set(key, {
              reference,
              signature: `${row.state}\0${revisionByIdentity.get(key) ?? ''}`
            });
          });
        const previous = yield* state.getTracking(orgId);
        const changedReferences = compareTrackingObservations(previous, observations);
        if (changedReferences.length > 0) {
          const affectedTypes = new Set(changedReferences.map(reference => reference.xmlName));
          const affectedSObjects = new Set(
            changedReferences.flatMap(reference =>
              reference.xmlName === 'CustomObject'
                ? [reference.fullName]
                : reference.xmlName === 'CustomField'
                  ? [reference.fullName.split('.')[0]]
                  : []
            )
          );
          yield* state.invalidateTypes(orgId, affectedTypes);
          if (affectedSObjects.size > 0) yield* state.invalidateSObjects(orgId, affectedSObjects);
          yield* state.setTracking(orgId, observations);
          yield* state.queuePersist(orgId);
          yield* PubSub.publish(catalogChanges, { kind: 'tracking', orgId, references: changedReferences });
        }
        yield* Effect.annotateCurrentSpan({
          orgId,
          observationCount: observations.size,
          changedCount: changedReferences.length,
          affectedTypeCount: new Set(changedReferences.map(reference => reference.xmlName)).size
        });
        return changedReferences;
      });

      const recordOperation = Effect.fn('OrgMetadataCatalogRecorder.recordOperation')(function* (
        event: MetadataOperationEvent
      ) {
        if (!event.orgId || event.changes.length === 0) return;
        const orgId = event.orgId;
        yield* state.ensureHydrated(orgId);
        const references = event.changes.map(change => ({
          xmlName: change.metadataType,
          fullName: change.fullName
        }));
        const affectedTypes = new Set(references.map(reference => reference.xmlName));
        const identities = new Set(references.map(componentIdentity));
        const affectedSObjects = new Set(
          references.flatMap(reference =>
            reference.xmlName === 'CustomObject'
              ? [reference.fullName]
              : reference.xmlName === 'CustomField'
                ? [reference.fullName.split('.')[0]]
                : []
          )
        );
        yield* state.invalidateTypes(orgId, affectedTypes);
        yield* state.removeTracking(orgId, identities);
        if (affectedSObjects.size > 0) yield* state.invalidateSObjects(orgId, affectedSObjects);
        yield* state.queuePersist(orgId);
        yield* PubSub.publish(catalogChanges, { kind: 'operation', event });
        yield* Effect.annotateCurrentSpan({
          orgId,
          operation: event.operation,
          changedCount: references.length,
          affectedTypeCount: affectedTypes.size,
          persistenceQueued: true
        });
      });

      return {
        recordMetadataListing,
        recordMetadataTypes,
        recordOperation,
        recordSObjectDescription,
        recordSObjectList,
        recordTrackingStatus
      } as const;
    })
  }
) {}
