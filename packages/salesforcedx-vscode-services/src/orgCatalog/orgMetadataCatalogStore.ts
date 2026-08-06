/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { URI, Utils } from 'vscode-uri';
import { SObjectSchema } from '../core/transmogrifierService';
import { FsService } from '../vscode/fsService';
import { WorkspaceService } from '../vscode/workspaceService';

const CATALOG_DIRECTORY = 'metadata-catalog';
const CATALOG_FILE = 'catalog.json';
const CATALOG_VERSION = 1;

class OrgMetadataCatalogSnapshotOrgMismatchError extends Schema.TaggedError<OrgMetadataCatalogSnapshotOrgMismatchError>()(
  'OrgMetadataCatalogSnapshotOrgMismatchError',
  { message: Schema.String }
) {}

export const isOrgMetadataCatalogUri = (workspaceUri: URI, uri: URI): boolean => {
  const root = Utils.joinPath(workspaceUri, '.sf', 'orgs');
  return (
    uri.scheme === root.scheme && uri.path.startsWith(`${root.path}/`) && uri.path.includes(`/${CATALOG_DIRECTORY}/`)
  );
};

const ProvenanceSchema = Schema.Literal(
  'metadata-api',
  'rest-api',
  'tooling-api',
  'workspace',
  'metadata-api+workspace',
  'source-tracking'
);

const PersistedListedComponentSchema = Schema.Struct({
  fullName: Schema.String,
  namespacePrefix: Schema.optional(Schema.String),
  manageableState: Schema.optional(Schema.String),
  fileName: Schema.optional(Schema.String),
  lastModifiedByName: Schema.optional(Schema.String),
  lastModifiedDate: Schema.optional(Schema.String)
});

const PersistedTypeInventorySchema = Schema.Struct({
  xmlName: Schema.String,
  observedAt: Schema.String,
  components: Schema.Array(PersistedListedComponentSchema),
  folders: Schema.Array(PersistedListedComponentSchema)
});
export type PersistedTypeInventory = typeof PersistedTypeInventorySchema.Type;

const PersistedSObjectSummarySchema = Schema.Struct({
  orgId: Schema.String,
  observedAt: Schema.String,
  provenance: ProvenanceSchema,
  remoteLastModifiedDate: Schema.optional(Schema.String),
  name: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean
});
const PersistedSObjectDescriptionSchema = Schema.Struct({
  ...SObjectSchema.fields,
  orgId: Schema.String,
  observedAt: Schema.String,
  provenance: ProvenanceSchema,
  remoteLastModifiedDate: Schema.optional(Schema.String)
});
const PersistedTrackingObservationSchema = Schema.Struct({
  xmlName: Schema.String,
  fullName: Schema.String,
  signature: Schema.String
});
const OrgMetadataCatalogSnapshotSchema = Schema.Struct({
  version: Schema.Literal(CATALOG_VERSION),
  orgId: Schema.String,
  writtenAt: Schema.String,
  generation: Schema.Number,
  inventory: Schema.Array(PersistedTypeInventorySchema),
  sobjects: Schema.Struct({
    list: PersistedSObjectSummarySchema.pipe(Schema.Array, Schema.optional),
    descriptions: Schema.Array(PersistedSObjectDescriptionSchema)
  }),
  tracking: Schema.Array(PersistedTrackingObservationSchema)
});
export type OrgMetadataCatalogSnapshot = typeof OrgMetadataCatalogSnapshotSchema.Type;

export class OrgMetadataCatalogStore extends Effect.Service<OrgMetadataCatalogStore>()('OrgMetadataCatalogStore', {
  accessors: true,
  dependencies: [FsService.Default, WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const [fsService, workspaceService] = yield* Effect.all([FsService, WorkspaceService]);
    const saveSemaphore = yield* Effect.makeSemaphore(1);

    const getRootUri = Effect.fn('OrgMetadataCatalogStore.getRootUri')(function* (orgId: string) {
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      return Utils.joinPath(workspace.uri, '.sf', 'orgs', encodeURIComponent(orgId), CATALOG_DIRECTORY);
    });

    const getSnapshotUri = Effect.fn('OrgMetadataCatalogStore.getSnapshotUri')(function* (orgId: string) {
      return Utils.joinPath(yield* getRootUri(orgId), CATALOG_FILE);
    });

    const load = Effect.fn('OrgMetadataCatalogStore.load')(function* (orgId: string) {
      const snapshotUri = yield* getSnapshotUri(orgId);
      if (!(yield* fsService.fileOrFolderExists(snapshotUri))) return undefined;
      const snapshot = yield* fsService.readJSON(snapshotUri.toString(), OrgMetadataCatalogSnapshotSchema);
      if (snapshot.orgId !== orgId) {
        return yield* new OrgMetadataCatalogSnapshotOrgMismatchError({
          message: `Catalog snapshot org '${snapshot.orgId}' does not match '${orgId}'`
        });
      }
      yield* Effect.annotateCurrentSpan({
        orgId,
        generation: snapshot.generation,
        inventoryTypeCount: snapshot.inventory.length,
        sobjectSummaryCount: snapshot.sobjects.list?.length ?? 0,
        sobjectDescriptionCount: snapshot.sobjects.descriptions.length,
        trackingObservationCount: snapshot.tracking.length
      });
      return snapshot;
    });

    const save = Effect.fn('OrgMetadataCatalogStore.save')(function* (snapshot: OrgMetadataCatalogSnapshot) {
      return yield* saveSemaphore.withPermits(1)(
        Effect.gen(function* () {
          const snapshotUri = yield* getSnapshotUri(snapshot.orgId);
          const stagingUri = URI.parse(`${snapshotUri.toString()}.__staging__`);
          const encoded = yield* Schema.encode(OrgMetadataCatalogSnapshotSchema)(snapshot);
          const content = JSON.stringify(encoded, null, 2);
          yield* fsService.safeWriteFile(stagingUri, content);
          yield* fsService.rename(stagingUri.toString(), snapshotUri.toString(), { overwrite: true });
          yield* Effect.annotateCurrentSpan({
            orgId: snapshot.orgId,
            generation: snapshot.generation,
            byteCount: new TextEncoder().encode(content).byteLength,
            inventoryTypeCount: snapshot.inventory.length,
            sobjectSummaryCount: snapshot.sobjects.list?.length ?? 0,
            sobjectDescriptionCount: snapshot.sobjects.descriptions.length,
            trackingObservationCount: snapshot.tracking.length
          });
          return snapshotUri;
        })
      );
    });

    return { getRootUri, getSnapshotUri, load, save };
  })
}) {}
