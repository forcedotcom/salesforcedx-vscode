/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  ListedMetadataComponent,
  RemoteTrackingObservation,
  RemoteTrackingObservations
} from './orgCatalogInternalTypes.js';
import {
  InactiveOrgOperationError,
  MetadataRegistryService,
  OrgMetadataCatalogChangePubSub,
  TransmogrifierService,
  documentUri,
  type MetadataOperationEvent,
  type OrgId,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataComponentReference,
  type OrgSObjectDescription,
  type OrgSObjectSummary
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Struct from 'effect/Struct';
import type { URI } from 'vscode-uri';
import { ConnectionHost } from '../connectionHost.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgChanges } from '../targetOrgRef.js';
import {
  componentIdentity,
  findInventoryComponent,
  referencesToAffectedSObjects,
  typeCacheKey
} from './orgCatalogKeys.js';
import { OrgCatalogState } from './orgCatalogState.js';

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
type RemoteComponent = {
  readonly type: string;
  readonly fullName: string;
  readonly namespacePrefix?: string;
  readonly lastModifiedDate?: string;
  readonly documentUri?: URI;
  readonly workspaceUri?: URI;
};
type RecordSObjectDescription = (
  orgId: OrgId,
  orgGeneration: number,
  ...raw: Parameters<TransmogrifierService['Service']['toMinimalSObject']>
) => Effect.Effect<
  void,
  Effect.Error<ReturnType<TransmogrifierService['Service']['toMinimalSObject']>> | InactiveOrgOperationError
>;
const observedAt = DateTime.now.pipe(Effect.map(DateTime.formatIso));
const compareTrackingObservations = (
  previous: RemoteTrackingObservations,
  current: RemoteTrackingObservations
): OrgMetadataComponentReference[] =>
  Arr.dedupe([...previous.identityOrder, ...current.identityOrder]).flatMap(identity => {
    const before = Option.getOrUndefined(HashMap.get(previous.byIdentity, identity));
    const after = Option.getOrUndefined(HashMap.get(current.byIdentity, identity));
    return before?.signature === after?.signature ? [] : after ? [after.reference] : before ? [before.reference] : [];
  });
const trackingObservations = (
  status: readonly TrackingStatusRow[],
  changes: readonly TrackingRemoteChange[]
): RemoteTrackingObservations => {
  const revisions = HashMap.fromIterable(
    changes.map(
      change =>
        [
          componentIdentity({ xmlName: change.type, fullName: change.name }),
          JSON.stringify([
            change.revisionCounter,
            change.lastModifiedDate,
            change.memberIdOrName,
            change.deleted,
            change.modified
          ])
        ] as const
    )
  );
  const remote = status.filter(row => row.origin === 'remote');
  return {
    byIdentity: HashMap.fromIterable(
      remote.map((row): readonly [string, RemoteTrackingObservation] => {
        const reference = { xmlName: row.type, fullName: row.fullName };
        const identity = componentIdentity(reference);
        return [
          identity,
          { reference, signature: `${row.state}\0${Option.getOrElse(HashMap.get(revisions, identity), () => '')}` }
        ];
      })
    ),
    identityOrder: Arr.dedupe(remote.map(row => componentIdentity({ xmlName: row.type, fullName: row.fullName })))
  };
};

const makeOrgMetadataCatalogRecorder = Effect.gen(function* () {
  const state = yield* OrgCatalogState;
  const catalogChanges = yield* OrgMetadataCatalogChangePubSub;
  const registry = yield* MetadataRegistryService;
  const transmogrifier = yield* TransmogrifierService;
  const changes = yield* OrgChanges;
  const host = yield* ConnectionHost;
  const operations = yield* ServiceOperations;
  const commit = <A, E, R>(orgId: OrgId, orgGeneration: number, program: Effect.Effect<A, E, R>) =>
    changes.commitIfCurrent(
      orgGeneration,
      new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) }),
      program
    );
  const recordMetadataTypes = Effect.fn('OrgMetadataCatalogRecorder.recordMetadataTypes')(function* (
    orgId: OrgId,
    orgGeneration: number,
    types: readonly MetadataTypeResult[]
  ) {
    yield* state.ensureHydrated(orgId);
    const normalized = types
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
    const timestamp = yield* observedAt;
    yield* commit(
      orgId,
      orgGeneration,
      Effect.gen(function* () {
        const previous = yield* state.getMetadataTypes(orgId);
        const changed =
          JSON.stringify(previous?.map(value => ({ ...value, observedAt: '' }))) !== JSON.stringify(normalized);
        if (changed) {
          yield* state.setMetadataTypes(
            orgId,
            normalized.map(value => ({ ...value, observedAt: timestamp }))
          );
          yield* state.queuePersist(orgId);
        }
        yield* Effect.annotateCurrentSpan({ orgId, observationCount: normalized.length, changed });
      })
    );
  }, operations.run);
  const recordMetadataListing = Effect.fn('OrgMetadataCatalogRecorder.recordMetadataListing')(function* (
    orgId: OrgId,
    orgGeneration: number,
    xmlName: string,
    folder: string | undefined,
    components: readonly ListedMetadataComponent[]
  ) {
    yield* state.ensureHydrated(orgId);
    const normalized = components
      .map(component => ({
        fullName: component.fullName,
        ...(component.namespacePrefix ? { namespacePrefix: component.namespacePrefix } : {}),
        ...(component.manageableState ? { manageableState: component.manageableState } : {}),
        ...(component.fileName ? { fileName: component.fileName } : {}),
        ...(component.lastModifiedByName ? { lastModifiedByName: component.lastModifiedByName } : {}),
        ...(component.lastModifiedDate ? { lastModifiedDate: component.lastModifiedDate } : {})
      }))
      .toSorted((left, right) => left.fullName.localeCompare(right.fullName));
    const timestamp = yield* observedAt;
    yield* commit(
      orgId,
      orgGeneration,
      Effect.gen(function* () {
        if (
          JSON.stringify((yield* state.getMetadataListing(orgId, xmlName, folder))?.components) ===
          JSON.stringify(normalized)
        )
          return;
        yield* state.setMetadataListing(orgId, {
          xmlName,
          ...(folder ? { folder } : {}),
          observedAt: timestamp,
          components: normalized
        });
        yield* state.queuePersist(orgId);
      })
    );
  }, operations.run);
  const recordSObjectList = Effect.fn('OrgMetadataCatalogRecorder.recordSObjectList')(function* (
    orgId: OrgId,
    orgGeneration: number,
    rows: readonly { readonly name: string; readonly custom: boolean; readonly queryable: boolean }[]
  ) {
    yield* state.ensureHydrated(orgId);
    const comparable = rows
      .map(({ name, custom, queryable }) => ({ name, custom, queryable }))
      .toSorted((left, right) => left.name.localeCompare(right.name));
    const timestamp = yield* observedAt;
    yield* commit(
      orgId,
      orgGeneration,
      Effect.gen(function* () {
        const previous = yield* state.getSObjectList(orgId);
        if (
          JSON.stringify(previous?.map(({ name, custom, queryable }) => ({ name, custom, queryable }))) ===
          JSON.stringify(comparable)
        )
          return;
        const observations: readonly OrgSObjectSummary[] = comparable.map(row => ({
          ...row,
          orgId,
          observedAt: timestamp,
          provenance: 'rest-api'
        }));
        yield* state.setSObjectList(orgId, observations);
        yield* state.queuePersist(orgId);
      })
    );
  }, operations.run);
  const recordSObjectDescription: RecordSObjectDescription = Effect.fn(
    'OrgMetadataCatalogRecorder.recordSObjectDescription'
  )(function* (orgId, orgGeneration, raw) {
    yield* state.ensureHydrated(orgId);
    const sobject = yield* transmogrifier.toMinimalSObject(raw);
    const timestamp = yield* observedAt;
    yield* commit(
      orgId,
      orgGeneration,
      Effect.gen(function* () {
        const previous = yield* state.getSObjectDescription(orgId, sobject.name);
        const comparable = previous
          ? Struct.omit(previous, ['orgId', 'observedAt', 'provenance', 'remoteLastModifiedDate'])
          : undefined;
        if (JSON.stringify(comparable) === JSON.stringify(sobject)) return;
        const row: OrgSObjectDescription = { ...sobject, orgId, observedAt: timestamp, provenance: 'rest-api' };
        yield* state.setSObjectDescription(orgId, row);
        yield* state.queuePersist(orgId);
      })
    );
  }, operations.run);
  const recordRemoteComponents = Effect.fn('OrgMetadataCatalogRecorder.recordRemoteComponents')(function* (
    orgId: OrgId,
    orgGeneration: number,
    provenance: 'metadata-api' | 'tooling-api',
    components: readonly RemoteComponent[]
  ) {
    if (components.length === 0) return;
    yield* state.ensureHydrated(orgId);
    const timestamp = yield* observedAt;
    const withUris = yield* Effect.forEach(
      components,
      component =>
        (component.documentUri
          ? Effect.succeed(component.documentUri)
          : documentUri({ orgId, xmlName: component.type, fullName: component.fullName }).pipe(
              Effect.provideService(MetadataRegistryService, registry)
            )
        ).pipe(Effect.map(uri => ({ component, uri }))),
      { concurrency: 'unbounded' }
    );
    yield* commit(
      orgId,
      orgGeneration,
      state
        .updateInventories(current =>
          withUris.reduce((inventories, { component, uri }) => {
            const reference = { xmlName: component.type, fullName: component.fullName };
            const key = typeCacheKey(orgId, component.type);
            const inventory = Option.getOrUndefined(HashMap.get(inventories, key));
            const previous = inventory
              ? findInventoryComponent(inventory.components, reference, component.namespacePrefix ?? null)
              : undefined;
            const entry: OrgMetadataCatalogInternalEntry = {
              ...previous,
              orgId,
              observedAt: timestamp,
              provenance:
                provenance === 'metadata-api' && (component.workspaceUri || previous?.inWorkspace)
                  ? 'metadata-api+workspace'
                  : provenance,
              reference,
              documentUri: uri,
              name: previous?.name ?? component.fullName.split('/').at(-1) ?? component.fullName,
              kind: 'component',
              namespacePrefix: component.namespacePrefix ?? previous?.namespacePrefix,
              inOrg: true,
              inWorkspace: Boolean(component.workspaceUri) || (previous?.inWorkspace ?? false),
              workspaceUri: component.workspaceUri ?? previous?.workspaceUri,
              lastModifiedDate: component.lastModifiedDate ?? previous?.lastModifiedDate,
              remoteLastModifiedDate: component.lastModifiedDate ?? previous?.remoteLastModifiedDate
            };
            const identity = componentIdentity(reference, component.namespacePrefix ?? null);
            return HashMap.set(inventories, key, {
              observedAt: timestamp,
              complete: inventory?.complete ?? false,
              components: HashMap.set(inventory?.components ?? HashMap.empty(), identity, entry),
              componentIdentityOrder: Arr.dedupe([...(inventory?.componentIdentityOrder ?? []), identity]),
              folders: inventory?.folders ?? HashMap.empty(),
              folderFullNameOrder: inventory?.folderFullNameOrder ?? []
            });
          }, current)
        )
        .pipe(Effect.andThen(state.queuePersist(orgId)))
    );
  }, operations.run);
  const prepareTrackingStatus = Effect.fn('OrgMetadataCatalogRecorder.prepareTrackingStatus')(function* (
    orgId: OrgId,
    status: readonly TrackingStatusRow[],
    remote: readonly TrackingRemoteChange[]
  ) {
    yield* state.ensureHydrated(orgId);
    const observations = trackingObservations(status, remote);
    return { observations, references: compareTrackingObservations(yield* state.getTracking(orgId), observations) };
  }, operations.run);
  const commitTrackingStatus = Effect.fn('OrgMetadataCatalogRecorder.commitTrackingStatus')(function* (
    orgId: OrgId,
    orgGeneration: number,
    prepared: Effect.Success<ReturnType<typeof prepareTrackingStatus>>
  ) {
    if (prepared.references.length === 0) return;
    const sobjects = referencesToAffectedSObjects(prepared.references);
    yield* state.withTypeInvalidation(
      orgId,
      new Set(prepared.references.map(reference => reference.xmlName)),
      invalidate =>
        commit(
          orgId,
          orgGeneration,
          invalidate.pipe(
            Effect.andThen(sobjects.size > 0 ? state.invalidateSObjects(orgId, sobjects) : Effect.void),
            Effect.andThen(state.setTracking(orgId, prepared.observations)),
            Effect.andThen(state.queuePersist(orgId)),
            Effect.andThen(PubSub.publish(catalogChanges, { kind: 'tracking', orgId, references: prepared.references }))
          )
        )
    );
  }, operations.run);
  const recordOperation = Effect.fn('OrgMetadataCatalogRecorder.recordOperation')(function* (
    event: MetadataOperationEvent,
    orgGeneration: number
  ) {
    if (!event.orgId || event.changes.length === 0) return;
    const orgId = event.orgId;
    yield* state.ensureHydrated(orgId);
    const references = event.changes.map(change => ({ xmlName: change.metadataType, fullName: change.fullName }));
    const sobjects = referencesToAffectedSObjects(references);
    yield* state.withTypeInvalidation(orgId, new Set(references.map(reference => reference.xmlName)), invalidate =>
      commit(
        orgId,
        orgGeneration,
        invalidate.pipe(
          Effect.andThen(
            state.removeTracking(orgId, new Set(references.map(reference => componentIdentity(reference))))
          ),
          Effect.andThen(sobjects.size > 0 ? state.invalidateSObjects(orgId, sobjects) : Effect.void),
          Effect.andThen(state.queuePersist(orgId)),
          Effect.andThen(PubSub.publish(catalogChanges, { kind: 'operation', event }))
        )
      )
    );
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return {
    recordMetadataTypes,
    recordMetadataListing,
    recordSObjectList,
    recordSObjectDescription,
    recordRemoteComponents,
    prepareTrackingStatus,
    commitTrackingStatus,
    recordOperation
  };
});
export class OrgMetadataCatalogRecorder extends Context.Service<
  OrgMetadataCatalogRecorder,
  Effect.Success<typeof makeOrgMetadataCatalogRecorder>
>()('@salesforce/vscode-services-v4-implementation/OrgMetadataCatalogRecorder') {}
export const OrgMetadataCatalogRecorderLayer = Layer.effect(
  OrgMetadataCatalogRecorder,
  makeOrgMetadataCatalogRecorder
).pipe(Layer.provideMerge(ServiceOperationsLayer));
