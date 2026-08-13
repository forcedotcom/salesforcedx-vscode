/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable barrel-files/avoid-barrel-files -- temporary re-export layer during refactoring. Consider removing once consumers can import directly from source modules. */

import type {
  OrgMetadataCatalogComponentReference,
  OrgMetadataCatalogEntry,
  OrgMetadataCatalogInternalEntry,
  OrgMetadataCatalogReference,
  OrgMetadataConsistency,
  OrgMetadataHierarchyConsistency
} from './orgMetadataCatalogTypes';
import type { OrgMetadataComponentReference, OrgMetadataReference } from './orgMetadataReference';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { FOLDERED_METADATA_TYPES, MetadataDescribeService } from '../core/metadataDescribeService';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { OrgCatalogState } from './orgCatalogState';
import { OrgCatalogTreeProjection } from './orgCatalogTreeProjection';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace';
import { OrgMetadataCatalogRecorder } from './orgMetadataCatalogRecorder';

export {
  OrgCatalogObservationSchema,
  OrgSObjectDescriptionSchema,
  OrgSObjectSummarySchema
} from './orgMetadataCatalogTypes';
export { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
export type {
  OrgCatalogObservation,
  OrgMetadataCatalogComponentReference,
  OrgMetadataCatalogEntry,
  OrgMetadataCatalogReference,
  OrgMetadataComponentResolution,
  OrgMetadataConsistency,
  OrgMetadataHierarchyConsistency,
  OrgMetadataEntryKind,
  OrgMetadataFieldDetails,
  OrgMetadataPresence,
  OrgSObjectDescription,
  OrgSObjectSummary
} from './orgMetadataCatalogTypes';

const toInternalReference = (reference: OrgMetadataCatalogReference): OrgMetadataReference => ({
  ...(reference.type ? { xmlName: reference.type } : {}),
  ...(reference.fullName ? { fullName: reference.fullName } : {})
});

const toInternalComponentReference = (
  reference: OrgMetadataCatalogComponentReference
): OrgMetadataComponentReference => ({ xmlName: reference.type, fullName: reference.fullName });

const toCatalogEntry = (entry: OrgMetadataCatalogInternalEntry): OrgMetadataCatalogEntry => ({
  ...entry,
  reference: {
    ...(entry.reference.xmlName ? { type: entry.reference.xmlName } : {}),
    ...(entry.reference.fullName ? { fullName: entry.reference.fullName } : {})
  }
});

/**
 * Canonical, services-owned inventory and content catalog for metadata in the
 * active org and workspace. Consumers query it; only services mutates its
 * caches in response to org, workspace, and retrieve lifecycle events.
 */
export class OrgMetadataCatalog extends Effect.Service<OrgMetadataCatalog>()('OrgMetadataCatalog', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    MetadataDescribeService.Default,
    OrgCatalogInventory.Default,
    OrgCatalogState.Default,
    OrgCatalogTreeProjection.Default,
    OrgCatalogWorkspace.Default,
    OrgMetadataCatalogRecorder.Default
  ],
  effect: Effect.gen(function* () {
    const [connectionService, metadataDescribeService, inventories, state, treeProjection, workspace, recorder] =
      yield* Effect.all([
        ConnectionService,
        MetadataDescribeService,
        OrgCatalogInventory,
        OrgCatalogState,
        OrgCatalogTreeProjection,
        OrgCatalogWorkspace,
        OrgMetadataCatalogRecorder
      ]);
    const getActiveOrgId = Effect.fn('OrgMetadataCatalog.getActiveOrgId')(function* () {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      if (orgId) return orgId;

      // Consumers can begin work as soon as TargetOrgRef announces an org. During extension-host
      // startup, however, a refresh can invalidate the shared connection while another service is
      // still observing that announcement. Re-acquiring the connection both restores defaultOrgRef
      // and gives the catalog the authoritative org id without requiring a prior metadata operation.
      const connection = yield* connectionService.getConnection();
      const connectionOrgId = connection.getAuthInfoFields().orgId;
      if (connectionOrgId) return connectionOrgId;

      return yield* Effect.fail(vscode.FileSystemError.Unavailable('No default org is configured'));
    });

    const resolveComponents = Effect.fn('OrgMetadataCatalog.resolveComponents')(function* (
      references: readonly OrgMetadataCatalogComponentReference[]
    ) {
      const orgId = yield* getActiveOrgId();
      const resolutions = yield* workspace.resolveComponents(orgId, references.map(toInternalComponentReference), {
        prefer: 'workspace'
      });
      yield* recorder.recordRemoteComponents(
        orgId,
        'tooling-api',
        resolutions.map(resolution => ({
          type: resolution.reference.xmlName,
          fullName: resolution.reference.fullName,
          ...(resolution.workspaceUri ? { workspaceUri: resolution.workspaceUri } : {})
        }))
      );
      return resolutions.map(resolution => ({
        ...resolution,
        reference: { type: resolution.reference.xmlName, fullName: resolution.reference.fullName }
      }));
    });

    const invalidateHierarchy = Effect.fn('OrgMetadataCatalog.invalidateHierarchy')(function* (
      orgId: string,
      reference: OrgMetadataReference
    ) {
      if (!reference.xmlName) {
        yield* metadataDescribeService.invalidateDescribe(orgId);
      } else if (FOLDERED_METADATA_TYPES.has(reference.xmlName)) {
        yield* metadataDescribeService.invalidateAllListMetadata(orgId);
      } else {
        yield* metadataDescribeService.invalidateListMetadata(reference.xmlName, undefined, orgId);
      }
      yield* state.ensureHydrated(orgId);
      yield* reference.xmlName
        ? state.invalidateTypes(orgId, new Set([reference.xmlName]))
        : state.invalidateOrgInventories(orgId);
      yield* state.persistOrg(orgId);
    });

    const getChildren = Effect.fn('OrgMetadataCatalog.getChildren')(function* (
      reference: OrgMetadataCatalogReference = {},
      options: { readonly consistency?: OrgMetadataHierarchyConsistency } = {}
    ) {
      const orgId = yield* getActiveOrgId();
      const internalReference = toInternalReference(reference);
      if (options.consistency === 'cache-only') {
        return internalReference.xmlName
          ? ((yield* treeProjection.getChildrenCached(orgId, internalReference)) ?? []).map(toCatalogEntry)
          : [];
      }
      if (options.consistency === 'refresh') yield* invalidateHierarchy(orgId, internalReference);
      return (yield* treeProjection.getChildren(orgId, internalReference)).map(toCatalogEntry);
    });

    const getEntries = Effect.fn('OrgMetadataCatalog.getEntries')(function* (
      references: readonly OrgMetadataCatalogComponentReference[],
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      const orgId = yield* getActiveOrgId();
      const internalReferences = references.map(toInternalComponentReference);
      if (options.consistency === 'refresh') {
        const xmlNames = new Set(internalReferences.map(reference => reference.xmlName));
        yield* Effect.forEach(
          xmlNames,
          xmlName =>
            FOLDERED_METADATA_TYPES.has(xmlName)
              ? metadataDescribeService.invalidateAllListMetadata(orgId)
              : metadataDescribeService.invalidateListMetadata(xmlName, undefined, orgId),
          { concurrency: 1, discard: true }
        );
        yield* state.ensureHydrated(orgId);
        yield* state.invalidateTypes(orgId, xmlNames);
        yield* state.persistOrg(orgId);
      }
      return yield* Effect.forEach(internalReferences, reference => inventories.getEntry(orgId, reference), {
        concurrency: 'unbounded'
      }).pipe(Effect.map(entries => entries.map(entry => (entry ? toCatalogEntry(entry) : entry))));
    });

    return {
      getChildren,
      getEntries,
      resolveComponents
    };
  })
}) {}
