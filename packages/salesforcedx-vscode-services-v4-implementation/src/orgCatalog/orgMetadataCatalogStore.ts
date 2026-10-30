/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FsService, OrgId, SObjectSchema, WorkspaceService } from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import { URI, Utils } from 'vscode-uri';
import { isFileNotFound } from '../errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';

const CATALOG_DIRECTORY = 'metadata-catalog';
const CATALOG_FILE = 'catalog.json';
const CATALOG_VERSION = 2;
class OrgMetadataCatalogSnapshotOrgMismatchError extends Schema.TaggedError<OrgMetadataCatalogSnapshotOrgMismatchError>()(
  'OrgMetadataCatalogSnapshotOrgMismatchError',
  { message: Schema.String }
) {}
const Provenance = Schema.Literals([
  'metadata-api',
  'rest-api',
  'tooling-api',
  'workspace',
  'metadata-api+workspace',
  'source-tracking'
]);
const ListedComponent = Schema.Struct({
  fullName: Schema.String,
  namespacePrefix: Schema.optional(Schema.String),
  manageableState: Schema.optional(Schema.String),
  fileName: Schema.optional(Schema.String),
  lastModifiedByName: Schema.optional(Schema.String),
  lastModifiedDate: Schema.optional(Schema.String)
});
const TypeInventory = Schema.Struct({
  xmlName: Schema.String,
  observedAt: Schema.String,
  complete: Schema.optional(Schema.Boolean),
  components: Schema.Array(ListedComponent),
  folders: Schema.Array(ListedComponent)
});
export type PersistedTypeInventory = typeof TypeInventory.Type;
const SObjectSummary = Schema.Struct({
  orgId: OrgId,
  observedAt: Schema.String,
  provenance: Provenance,
  remoteLastModifiedDate: Schema.optional(Schema.String),
  name: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean
});
const SObjectDescription = Schema.Struct({
  ...SObjectSchema.fields,
  orgId: OrgId,
  observedAt: Schema.String,
  provenance: Provenance,
  remoteLastModifiedDate: Schema.optional(Schema.String)
});
const TrackingObservation = Schema.Struct({
  xmlName: Schema.String,
  fullName: Schema.String,
  signature: Schema.String
});
const MetadataTypeObservation = Schema.Struct({
  xmlName: Schema.String,
  directoryName: Schema.String,
  suffix: Schema.optional(Schema.String),
  folderContentType: Schema.optional(Schema.String),
  inFolder: Schema.Boolean,
  metaFile: Schema.Boolean,
  childXmlNames: Schema.Array(Schema.String),
  observedAt: Schema.String
});
const MetadataListingObservation = Schema.Struct({
  xmlName: Schema.String,
  folder: Schema.optional(Schema.String),
  observedAt: Schema.String,
  components: Schema.Array(ListedComponent)
});
const SnapshotFields = {
  orgId: OrgId,
  writtenAt: Schema.String,
  generation: Schema.Number,
  inventory: Schema.Array(TypeInventory),
  sobjects: Schema.Struct({
    list: SObjectSummary.pipe(Schema.Array, Schema.optional),
    descriptions: Schema.Array(SObjectDescription)
  }),
  tracking: Schema.Array(TrackingObservation)
};
const SnapshotV1 = Schema.Struct({ version: Schema.Literal(1), ...SnapshotFields });
const Snapshot = Schema.Struct({
  version: Schema.Literal(CATALOG_VERSION),
  ...SnapshotFields,
  metadataTypes: Schema.Array(MetadataTypeObservation),
  metadataListings: Schema.Array(MetadataListingObservation)
});
export type OrgMetadataCatalogSnapshot = typeof Snapshot.Type;
const attributes = (snapshot: OrgMetadataCatalogSnapshot) => ({
  orgId: snapshot.orgId,
  generation: snapshot.generation,
  inventoryTypeCount: snapshot.inventory.length,
  sobjectSummaryCount: snapshot.sobjects.list?.length ?? 0,
  sobjectDescriptionCount: snapshot.sobjects.descriptions.length,
  trackingObservationCount: snapshot.tracking.length,
  metadataTypeCount: snapshot.metadataTypes.length,
  metadataListingCount: snapshot.metadataListings.length
});

const makeOrgMetadataCatalogStore = Effect.gen(function* () {
  const fs = yield* FsService;
  const workspace = yield* WorkspaceService;
  const operations = yield* ServiceOperations;
  const savePermit = yield* Semaphore.make(1);
  const getRootUri = Effect.fn('OrgMetadataCatalogStore.getRootUri')(function* (orgId: OrgId) {
    // Canonical Salesforce IDs are already path-safe; no potentially failing URI encoding is necessary.
    const info = yield* workspace.getWorkspaceInfoOrThrow();
    return Utils.joinPath(info.uri, '.sf', 'orgs', orgId, CATALOG_DIRECTORY);
  });
  const getSnapshotUri = Effect.fn('OrgMetadataCatalogStore.getSnapshotUri')(function* (orgId: OrgId) {
    return Utils.joinPath(yield* getRootUri(orgId), CATALOG_FILE);
  });
  const load = Effect.fn('OrgMetadataCatalogStore.load')(function* (orgId: OrgId) {
    const uri = yield* getSnapshotUri(orgId);
    const exists = yield* fs.stat(uri).pipe(
      Effect.as(true),
      Effect.catchTag('FsServiceError', error =>
        isFileNotFound(error.cause) ? Effect.succeed(false) : Effect.fail(error)
      )
    );
    if (!exists) return undefined;
    const decoded = yield* fs.readJSON(uri.toString(), Schema.Union([SnapshotV1, Snapshot]));
    const snapshot: OrgMetadataCatalogSnapshot =
      decoded.version === 1
        ? { ...decoded, version: CATALOG_VERSION, metadataTypes: [], metadataListings: [] }
        : decoded;
    if (snapshot.orgId !== orgId)
      return yield* new OrgMetadataCatalogSnapshotOrgMismatchError({
        message: `Catalog snapshot org '${snapshot.orgId}' does not match '${orgId}'`
      });
    yield* Effect.annotateCurrentSpan(attributes(snapshot));
    return snapshot;
  });
  const save = Effect.fn('OrgMetadataCatalogStore.save')((snapshot: OrgMetadataCatalogSnapshot) =>
    savePermit.withPermit(
      Effect.gen(function* () {
        const uri = yield* getSnapshotUri(snapshot.orgId);
        const staging = URI.parse(`${uri.toString()}.__staging__`);
        const encoded = yield* Schema.encodeEffect(Snapshot)(snapshot);
        const content = JSON.stringify(encoded, null, 2);
        // The caller may be a privileged shutdown flush. Settle native writes/rename before releasing ownership.
        yield* fs
          .safeWriteFile(staging, content)
          .pipe(
            Effect.andThen(fs.rename(staging.toString(), uri.toString(), { overwrite: true })),
            Effect.uninterruptible,
            Effect.ensuring(fs.safeDelete(staging))
          );
        yield* Effect.annotateCurrentSpan({
          ...attributes(snapshot),
          byteCount: new TextEncoder().encode(content).byteLength
        });
        return uri;
      })
    )
  );
  yield* Effect.addFinalizer(() => operations.close);
  return {
    service: {
      getSnapshotUri: (orgId: OrgId) => operations.run(getSnapshotUri(orgId)),
      load: (orgId: OrgId) => operations.run(load(orgId)),
      save: (snapshot: OrgMetadataCatalogSnapshot) => operations.run(save(snapshot))
    },
    // Only the scope-owned persistence worker/finalizer uses this after ordinary admission closes.
    cleanup: { load, save }
  };
});
export class OrgMetadataCatalogStore extends Context.Service<
  OrgMetadataCatalogStore,
  Effect.Success<typeof makeOrgMetadataCatalogStore>['service']
>()('@salesforce/vscode-services-v4-implementation/OrgMetadataCatalogStore') {}
export class OrgMetadataCatalogStoreCleanup extends Context.Service<
  OrgMetadataCatalogStoreCleanup,
  Effect.Success<typeof makeOrgMetadataCatalogStore>['cleanup']
>()('@salesforce/vscode-services-v4-implementation/OrgMetadataCatalogStoreCleanup') {}
export const OrgMetadataCatalogStoreLayer = Layer.effectContext(
  Effect.gen(function* () {
    const store = yield* makeOrgMetadataCatalogStore;
    return Context.make(OrgMetadataCatalogStore, store.service).pipe(
      Context.add(OrgMetadataCatalogStoreCleanup, store.cleanup)
    );
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
