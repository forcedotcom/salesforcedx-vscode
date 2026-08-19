/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TypeInventory } from './orgCatalogInternalTypes';
import type { OrgMetadataPresence } from './orgMetadataCatalogTypes';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { FOLDERED_METADATA_TYPES, MetadataDescribeService } from '../core/metadataDescribeService';
import { emptyPresence, typeCacheKey } from './orgCatalogKeys';
import { mergeInventory, projectChildren } from './orgCatalogProjection';
import { OrgCatalogState } from './orgCatalogState';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace';
import {
  isOrgMetadataComponentReference,
  OrgMetadataReferenceService,
  type OrgMetadataComponentReference
} from './orgMetadataReference';

export class OrgCatalogInventory extends Effect.Service<OrgCatalogInventory>()('OrgCatalogInventory', {
  accessors: true,
  dependencies: [
    OrgCatalogState.Default,
    OrgCatalogWorkspace.Default,
    OrgMetadataReferenceService.Default,
    MetadataDescribeService.Default
  ],
  effect: Effect.gen(function* () {
    const [state, workspace, references, metadataDescribeService] = yield* Effect.all([
      OrgCatalogState,
      OrgCatalogWorkspace,
      OrgMetadataReferenceService,
      MetadataDescribeService
    ]);
    const entryUri = (orgId: string, xmlName: string, fullName: string) =>
      references.documentUri({ orgId, xmlName, fullName: fullName || '__type__' });
    const loadType = Effect.fn('OrgCatalogInventory.loadType')(function* (orgId: string, xmlName: string) {
      yield* state.ensureHydrated(orgId);
      const key = typeCacheKey(orgId, xmlName);
      const cached = yield* state.getInventory(orgId, xmlName);
      if (cached?.complete) return cached;
      const semaphore = yield* state.getInventorySemaphore(key);
      return yield* Effect.gen(function* () {
        const coalesced = yield* state.getInventory(orgId, xmlName);
        if (coalesced?.complete) return coalesced;
        const restored = yield* state.getPersistedInventory(orgId, xmlName);
        const listOrgComponents =
          restored && restored.complete !== false
            ? Effect.succeed({ components: restored.components, folders: restored.folders })
            : FOLDERED_METADATA_TYPES.has(xmlName)
              ? Effect.gen(function* () {
                  const folders = yield* metadataDescribeService.listMetadata(`${xmlName}Folder`, undefined, orgId);
                  const folderComponents = yield* Effect.all(
                    folders.map(folder => metadataDescribeService.listMetadata(xmlName, folder.fullName, orgId)),
                    { concurrency: 10 }
                  );
                  return { components: folderComponents.flat(), folders };
                })
              : metadataDescribeService
                  .listMetadata(xmlName, undefined, orgId)
                  .pipe(Effect.map(components => ({ components, folders: [] })));
        const [orgListing, workspaceUris] = yield* Effect.all(
          [
            listOrgComponents,
            workspace.scanWorkspace(xmlName).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, URI>())))
          ],
          { concurrency: 'unbounded' }
        );
        const observedAt = restored && restored.complete !== false ? restored.observedAt : new Date().toISOString();
        const inventory = {
          observedAt,
          complete: true,
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
        if (!restored) yield* state.queuePersist(orgId);
        return inventory;
      }).pipe(semaphore.withPermits(1));
    });

    const getPresence = Effect.fn('OrgCatalogInventory.getPresence')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference
    ) {
      const cachedEntry = (yield* state.getInventory(orgId, reference.xmlName))?.components.get(reference.fullName);
      const entry = cachedEntry ?? (yield* loadType(orgId, reference.xmlName)).components.get(reference.fullName);
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
      const cached = yield* state.getInventory(orgId, reference.xmlName);
      const inventory = cached?.components.has(reference.fullName) ? cached : yield* loadType(orgId, reference.xmlName);
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
  })
}) {}
