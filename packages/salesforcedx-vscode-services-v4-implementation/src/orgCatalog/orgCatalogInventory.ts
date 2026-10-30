/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TypeInventory } from './orgCatalogInternalTypes.js';
import type { PersistedTypeInventory } from './orgMetadataCatalogStore.js';
import {
  FOLDERED_METADATA_TYPES,
  MetadataDescribeService,
  MetadataRegistryService,
  OrgMetadataCatalogError,
  isOrgMetadataComponentReference,
  type OrgMetadataComponentReference
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { componentIdentity, findInventoryComponent, typeCacheKey } from './orgCatalogKeys.js';
import { makeOrgCatalogOrg, type CatalogOrg } from './orgCatalogOrg.js';
import { mergeInventory, projectChildren } from './orgCatalogProjection.js';
import { OrgCatalogState } from './orgCatalogState.js';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace.js';

const makeOrgCatalogInventory = Effect.gen(function* () {
  const state = yield* OrgCatalogState;
  const workspace = yield* OrgCatalogWorkspace;
  const registry = yield* MetadataRegistryService;
  const descriptions = yield* MetadataDescribeService;
  const orgs = yield* makeOrgCatalogOrg;
  const operations = yield* ServiceOperations;
  const buildInventory = Effect.fn('OrgCatalogInventory.buildInventory')(function* (
    org: CatalogOrg,
    xmlName: string,
    generation: number,
    listing: Pick<PersistedTypeInventory, 'components' | 'folders'>,
    local: Effect.Success<ReturnType<typeof workspace.scanWorkspaceInventory>>,
    restored?: PersistedTypeInventory
  ) {
    const observedAt =
      restored && restored.complete !== false
        ? restored.observedAt
        : yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    const inventory: TypeInventory = {
      observedAt,
      complete: true,
      components: yield* mergeInventory({
        orgId: org.orgId,
        xmlName,
        orgComponents: listing.components,
        workspaceUris: local.components,
        workspacePresenceAvailable: local.workspacePresenceAvailable,
        workspaceNamespace: local.namespace,
        observedAt
      }).pipe(Effect.provideService(MetadataRegistryService, registry)),
      componentIdentityOrder: Arr.dedupe(
        listing.components.map(component =>
          componentIdentity({ xmlName, fullName: component.fullName }, component.namespacePrefix ?? null)
        )
      ),
      workspacePresenceAvailable: local.workspacePresenceAvailable,
      folders: HashMap.fromIterable(listing.folders.map(folder => [folder.fullName, folder] as const)),
      folderFullNameOrder: Arr.dedupe(listing.folders.map(folder => folder.fullName))
    };
    yield* state.withHierarchyCommit(
      orgs.commit(
        org,
        state.getHierarchyGeneration(org.orgId).pipe(
          Effect.flatMap(current =>
            current === generation
              ? state
                  .setInventory(org.orgId, xmlName, inventory)
                  .pipe(
                    Effect.andThen(
                      !restored || restored.complete === false ? state.queuePersist(org.orgId) : Effect.void
                    )
                  )
              : Effect.fail(
                  new OrgMetadataCatalogError({
                    reference: { xmlName },
                    message: 'Metadata changed while its inventory was being read',
                    cause: 'Catalog hierarchy invalidated'
                  })
                )
          )
        )
      )
    );
    return inventory;
  });
  const loadType = Effect.fn('OrgCatalogInventory.loadType')(function* (org: CatalogOrg, xmlName: string) {
    yield* orgs.validate(org);
    yield* state.ensureHydrated(org.orgId);
    const semaphore = yield* state.getInventorySemaphore(typeCacheKey(org.orgId, xmlName));
    return yield* semaphore.withPermit(
      Effect.gen(function* () {
        yield* orgs.validate(org);
        const { cached, restored, generation } = yield* state.getInventorySnapshot(org.orgId, xmlName);
        if (cached?.complete) return cached;
        const listing = Match.value({ restored, foldered: FOLDERED_METADATA_TYPES.has(xmlName) }).pipe(
          Match.when(
            value => value.restored !== undefined && value.restored.complete !== false,
            () => Effect.succeed({ components: restored!.components, folders: restored!.folders })
          ),
          Match.when({ foldered: true }, () =>
            descriptions.listMetadata(`${xmlName}Folder`, undefined, org.orgId).pipe(
              Effect.flatMap(folders =>
                Effect.forEach(folders, folder => descriptions.listMetadata(xmlName, folder.fullName, org.orgId), {
                  concurrency: 10
                }).pipe(Effect.map(rows => ({ components: rows.flat(), folders })))
              )
            )
          ),
          Match.orElse(() =>
            descriptions
              .listMetadata(xmlName, undefined, org.orgId)
              .pipe(Effect.map(components => ({ components, folders: [] })))
          )
        );
        const [orgListing, local] = yield* Effect.all([listing, workspace.scanWorkspaceInventory(xmlName)], {
          concurrency: 'unbounded'
        });
        return yield* buildInventory(org, xmlName, generation, orgListing, local, restored);
      })
    );
  }, operations.run);
  /** Disk/volatile observations only. Completeness and restoration share the existing inventory permit. */
  const loadCachedType = Effect.fn('OrgCatalogInventory.loadCachedType')(function* (org: CatalogOrg, xmlName: string) {
    yield* orgs.validate(org);
    yield* state.ensureHydrated(org.orgId);
    const semaphore = yield* state.getInventorySemaphore(typeCacheKey(org.orgId, xmlName));
    return yield* semaphore.withPermit(
      Effect.gen(function* () {
        yield* orgs.validate(org);
        const { cached, restored, generation } = yield* state.getInventorySnapshot(org.orgId, xmlName);
        if (cached?.complete) return cached;
        if (!restored || restored.complete === false) return undefined;
        return yield* workspace
          .scanWorkspaceInventory(xmlName)
          .pipe(Effect.flatMap(local => buildInventory(org, xmlName, generation, restored, local, restored)));
      })
    );
  }, operations.run);
  const getEntry = Effect.fn('OrgCatalogInventory.getEntry')(function* (
    org: CatalogOrg,
    reference: OrgMetadataComponentReference
  ) {
    yield* orgs.validate(org);
    const cached = yield* state.getInventory(org.orgId, reference.xmlName);
    const inventory =
      cached && findInventoryComponent(cached.components, reference) ? cached : yield* loadType(org, reference.xmlName);
    return (
      findInventoryComponent(inventory.components, reference) ??
      (yield* projectChildren(
        org.orgId,
        reference.xmlName,
        reference.fullName.split('/').slice(0, -1).join('/') || undefined,
        inventory
      ).pipe(Effect.provideService(MetadataRegistryService, registry))).find(
        entry => isOrgMetadataComponentReference(entry.reference) && entry.reference.fullName === reference.fullName
      )
    );
  }, operations.run);
  const getCachedInventory = Effect.fn('OrgCatalogInventory.getCachedInventory')(
    (org: CatalogOrg, xmlName: string) =>
      orgs.validate(org).pipe(Effect.andThen(state.getInventory(org.orgId, xmlName))),
    operations.run
  );
  yield* Effect.addFinalizer(() => operations.close);
  return { getCachedInventory, getEntry, loadType, loadCachedType };
});
export class OrgCatalogInventory extends Context.Service<
  OrgCatalogInventory,
  Effect.Success<typeof makeOrgCatalogInventory>
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogInventory') {}
export const OrgCatalogInventoryLayer = Layer.effect(OrgCatalogInventory, makeOrgCatalogInventory).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
