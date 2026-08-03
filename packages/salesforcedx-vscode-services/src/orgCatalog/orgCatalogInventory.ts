/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TypeInventory } from './orgCatalogInternalTypes';
import type { makeOrgCatalogWorkspace } from './orgCatalogWorkspace';
import type { PersistedTypeInventory } from './orgMetadataCatalogStore';
import type { OrgMetadataPresence } from './orgMetadataCatalogTypes';
import type { MetadataDescribeService } from '../core/metadataDescribeService';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { emptyPresence, typeCacheKey } from './orgCatalogKeys';
import { mergeInventory, projectChildren } from './orgCatalogProjection';
import { isOrgMetadataComponentReference, type OrgMetadataComponentReference } from './orgMetadataReference';

export const FOLDERED_METADATA_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);

type InventoryState = {
  readonly ensureHydrated: (orgId: string) => Effect.Effect<void>;
  readonly getInventory: (orgId: string, xmlName: string) => Effect.Effect<TypeInventory | undefined>;
  readonly getPersistedInventory: (orgId: string, xmlName: string) => Effect.Effect<PersistedTypeInventory | undefined>;
  readonly persistOrg: (orgId: string) => Effect.Effect<void>;
  readonly setInventory: (orgId: string, xmlName: string, inventory: TypeInventory) => Effect.Effect<void>;
  readonly withTypeLock: <A, E, R>(key: string, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
};

type OrgCatalogInventoryOptions = {
  readonly state: InventoryState;
  readonly workspace: ReturnType<typeof makeOrgCatalogWorkspace>;
  readonly metadataDescribeService: InstanceType<typeof MetadataDescribeService>;
  readonly entryUri: (orgId: string, xmlName: string, fullName: string) => URI;
};

export const makeOrgCatalogInventory = ({
  state,
  workspace,
  metadataDescribeService,
  entryUri
}: OrgCatalogInventoryOptions) => {
  const loadType = Effect.fn('OrgCatalogInventory.loadType')(function* (orgId: string, xmlName: string) {
    yield* state.ensureHydrated(orgId);
    const key = typeCacheKey(orgId, xmlName);
    const cached = yield* state.getInventory(orgId, xmlName);
    if (cached) return cached;
    return yield* state.withTypeLock(
      key,
      Effect.gen(function* () {
        const coalesced = yield* state.getInventory(orgId, xmlName);
        if (coalesced) return coalesced;
        const restored = yield* state.getPersistedInventory(orgId, xmlName);
        const listOrgComponents = restored
          ? Effect.succeed({ components: restored.components, folders: restored.folders })
          : FOLDERED_METADATA_TYPES.has(xmlName)
            ? Effect.gen(function* () {
                const folders = yield* metadataDescribeService.listMetadata(`${xmlName}Folder`);
                const folderComponents = yield* Effect.all(
                  folders.map(folder => metadataDescribeService.listMetadata(xmlName, folder.fullName)),
                  { concurrency: 10 }
                );
                return { components: folderComponents.flat(), folders };
              })
            : metadataDescribeService
                .listMetadata(xmlName)
                .pipe(Effect.map(components => ({ components, folders: [] })));
        const [orgListing, workspaceUris] = yield* Effect.all(
          [
            listOrgComponents,
            workspace.scanWorkspace(xmlName).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, URI>())))
          ],
          { concurrency: 'unbounded' }
        );
        const observedAt = restored?.observedAt ?? new Date().toISOString();
        const inventory = {
          observedAt,
          components: mergeInventory({
            entryUri,
            orgId,
            xmlName,
            orgComponents: orgListing.components,
            workspaceUris,
            observedAt
          }),
          folders: new Map(orgListing.folders.map(folder => [folder.fullName, folder]))
        } satisfies TypeInventory;
        yield* state.setInventory(orgId, xmlName, inventory);
        if (!restored) yield* state.persistOrg(orgId);
        return inventory;
      })
    );
  });

  const getPresence = Effect.fn('OrgCatalogInventory.getPresence')(function* (
    orgId: string,
    reference: OrgMetadataComponentReference
  ) {
    const entry = (yield* loadType(orgId, reference.xmlName)).components.get(reference.fullName);
    return entry
      ? ({
          inOrg: entry.inOrg,
          inWorkspace: entry.inWorkspace,
          ...(entry.workspaceUri ? { workspaceUri: entry.workspaceUri } : {})
        } satisfies OrgMetadataPresence)
      : emptyPresence();
  });

  const getEntry = Effect.fn('OrgCatalogInventory.getEntry')(function* (
    orgId: string,
    reference: OrgMetadataComponentReference
  ) {
    const inventory = yield* loadType(orgId, reference.xmlName);
    return (
      inventory.components.get(reference.fullName) ??
      projectChildren(
        entryUri,
        orgId,
        reference.xmlName,
        reference.fullName.split('/').slice(0, -1).join('/') || undefined,
        inventory
      ).find(
        entry => isOrgMetadataComponentReference(entry.reference) && entry.reference.fullName === reference.fullName
      )
    );
  });

  const getCachedInventory = Effect.fn('OrgCatalogInventory.getCachedInventory')(function* (
    orgId: string,
    xmlName: string
  ) {
    return yield* state.getInventory(orgId, xmlName);
  });

  return { getCachedInventory, getEntry, getPresence, loadType } as const;
};
