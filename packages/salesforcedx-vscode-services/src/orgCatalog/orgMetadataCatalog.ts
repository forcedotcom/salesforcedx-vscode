/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable barrel-files/avoid-barrel-files -- preserve the existing public catalog module while internals are decomposed */

import type { OrgMetadataConsistency } from './orgMetadataCatalogTypes';
import type { OrgMetadataComponentReference, OrgMetadataReference } from './orgMetadataReference';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { OrgCatalogDocuments } from './orgCatalogDocuments';
import { FOLDERED_METADATA_TYPES, OrgCatalogInventory } from './orgCatalogInventory';
import { OrgCatalogRemoteSource } from './orgCatalogRemoteSource';
import { OrgCatalogState } from './orgCatalogState';
import { OrgCatalogTreeProjection } from './orgCatalogTreeProjection';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace';

export {
  OrgCatalogObservationSchema,
  OrgSObjectDescriptionSchema,
  OrgSObjectSummarySchema
} from './orgMetadataCatalogTypes';
export { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
export type {
  KnownOrgMetadataComponentResolution,
  OrgCatalogObservation,
  OrgMetadataCatalogEntry,
  OrgMetadataConsistency,
  OrgMetadataEntryKind,
  OrgMetadataFieldDetails,
  OrgMetadataPresence,
  OrgSObjectDescription,
  OrgSObjectSummary
} from './orgMetadataCatalogTypes';

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
    OrgCatalogDocuments.Default,
    OrgCatalogInventory.Default,
    OrgCatalogRemoteSource.Default,
    OrgCatalogState.Default,
    OrgCatalogTreeProjection.Default,
    OrgCatalogWorkspace.Default
  ],
  effect: Effect.gen(function* () {
    const [
      connectionService,
      metadataDescribeService,
      documents,
      inventories,
      remoteSource,
      state,
      treeProjection,
      workspace
    ] = yield* Effect.all([
      ConnectionService,
      MetadataDescribeService,
      OrgCatalogDocuments,
      OrgCatalogInventory,
      OrgCatalogRemoteSource,
      OrgCatalogState,
      OrgCatalogTreeProjection,
      OrgCatalogWorkspace
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

    const resolveKnownOrgComponents = Effect.fn('OrgMetadataCatalog.resolveKnownOrgComponents')(function* (
      references: readonly OrgMetadataComponentReference[]
    ) {
      const orgId = yield* getActiveOrgId();
      return yield* workspace.resolveKnownOrgComponents(orgId, references);
    });

    const getPresence = Effect.fn('OrgMetadataCatalog.getPresence')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const orgId = yield* getActiveOrgId();
      return yield* inventories.getPresence(orgId, reference);
    });

    const getWorkspaceMetadataTypes = Effect.fn('OrgMetadataCatalog.getWorkspaceMetadataTypes')(function* () {
      const orgId = yield* getActiveOrgId();
      return yield* workspace.getWorkspaceMetadataTypes(orgId);
    });

    const getSObjectsCached = Effect.fn('OrgMetadataCatalog.getSObjectsCached')(function* () {
      const orgId = yield* getActiveOrgId();
      yield* state.ensureHydrated(orgId);
      return yield* state.getSObjectList(orgId);
    });

    const getSObjectCached = Effect.fn('OrgMetadataCatalog.getSObjectCached')(function* (apiName: string) {
      const orgId = yield* getActiveOrgId();
      yield* state.ensureHydrated(orgId);
      return yield* state.getSObjectDescription(orgId, apiName);
    });

    const getTrackingObservationsCached = Effect.fn('OrgMetadataCatalog.getTrackingObservationsCached')(function* () {
      const orgId = yield* getActiveOrgId();
      yield* state.ensureHydrated(orgId);
      return [...(yield* state.getTracking(orgId)).values()];
    });

    const getChildren = Effect.fn('OrgMetadataCatalog.getChildren')(function* (reference: OrgMetadataReference = {}) {
      const orgId = yield* getActiveOrgId();
      return yield* treeProjection.getChildren(orgId, reference);
    });

    const getChildrenCached = Effect.fn('OrgMetadataCatalog.getChildrenCached')(function* (
      reference: OrgMetadataReference
    ) {
      if (!reference.xmlName) return undefined;
      const orgId = yield* getActiveOrgId();
      return yield* treeProjection.getChildrenCached(orgId, reference);
    });

    const getEntry = Effect.fn('OrgMetadataCatalog.getEntry')(function* (reference: OrgMetadataComponentReference) {
      const orgId = yield* getActiveOrgId();
      return yield* inventories.getEntry(orgId, reference);
    });

    const getDocumentUri = Effect.fn('OrgMetadataCatalog.getDocumentUri')(function* (
      reference: OrgMetadataComponentReference
    ) {
      return yield* documents.getDocumentUri(yield* getActiveOrgId(), reference);
    });

    const materializeRemoteSources = Effect.fn('OrgMetadataCatalog.materializeRemoteSources')(function* (
      references: readonly OrgMetadataComponentReference[],
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      return yield* remoteSource.materializeRemoteSources(yield* getActiveOrgId(), references, options);
    });

    const materializeRemoteSource = Effect.fn('OrgMetadataCatalog.materializeRemoteSource')(function* (
      reference: OrgMetadataComponentReference,
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      return yield* remoteSource.materializeRemoteSource(yield* getActiveOrgId(), reference, options);
    });

    const getRemoteDocument = Effect.fn('OrgMetadataCatalog.getRemoteDocument')(function* (
      reference: OrgMetadataComponentReference
    ) {
      return yield* documents.getRemoteDocument(yield* getActiveOrgId(), reference);
    });

    const read = Effect.fn('OrgMetadataCatalog.read')(function* (reference: OrgMetadataComponentReference) {
      return yield* documents.read(yield* getActiveOrgId(), reference);
    });

    const readDocumentUri = Effect.fn('OrgMetadataCatalog.readDocumentUri')(function* (uri: URI) {
      return yield* documents.readDocumentUri(yield* getActiveOrgId(), uri);
    });

    const getDocumentReference = Effect.fn('OrgMetadataCatalog.getDocumentReference')(function* (uri: URI) {
      return yield* documents.getDocumentReference(yield* getActiveOrgId(), uri);
    });

    const invalidate = Effect.fn('OrgMetadataCatalog.invalidate')(function* () {
      const orgId = yield* getActiveOrgId();
      yield* state.ensureHydrated(orgId);
      yield* state.invalidateOrgInventories(orgId);
      yield* state.persistOrg(orgId);
    });

    const invalidateReferencesInternal = Effect.fn('OrgMetadataCatalog.invalidateReferencesInternal')(function* (
      orgId: string,
      references: readonly OrgMetadataComponentReference[],
      persist: boolean
    ) {
      yield* state.ensureHydrated(orgId);
      const affectedTypes = new Set(references.map(reference => reference.xmlName));
      const affectedIdentities = new Set(references.map(reference => `${reference.xmlName}\0${reference.fullName}`));
      yield* state.invalidateTypes(orgId, affectedTypes);
      yield* state.removeTracking(orgId, affectedIdentities);
      yield* Effect.forEach(
        affectedTypes,
        xmlName =>
          FOLDERED_METADATA_TYPES.has(xmlName)
            ? metadataDescribeService.invalidateAllListMetadata(orgId)
            : metadataDescribeService.invalidateListMetadata(xmlName, undefined, orgId),
        { discard: true }
      );
      const affectedSObjects = new Set<string>();
      references.forEach(reference => {
        if (reference.xmlName === 'CustomObject') affectedSObjects.add(reference.fullName);
        if (reference.xmlName === 'CustomField') affectedSObjects.add(reference.fullName.split('.')[0]);
      });
      if (affectedSObjects.size > 0) {
        yield* metadataDescribeService.invalidateSObjectDescribes([...affectedSObjects], orgId);
        yield* metadataDescribeService.invalidateListSObjects(orgId);
        yield* state.invalidateSObjects(orgId, affectedSObjects);
      }
      if (persist) yield* state.persistOrg(orgId);
    });

    const invalidateReferences = Effect.fn('OrgMetadataCatalog.invalidateReferences')(function* (
      references: readonly OrgMetadataComponentReference[]
    ) {
      yield* invalidateReferencesInternal(yield* getActiveOrgId(), references, true);
    });

    const refresh = Effect.fn('OrgMetadataCatalog.refresh')(function* (reference: OrgMetadataReference = {}) {
      const orgId = yield* getActiveOrgId();
      if (!reference.xmlName) {
        yield* metadataDescribeService.invalidateDescribe(orgId);
      } else if (FOLDERED_METADATA_TYPES.has(reference.xmlName)) {
        yield* metadataDescribeService.invalidateAllListMetadata(orgId);
      } else {
        yield* metadataDescribeService.invalidateListMetadata(reference.xmlName, undefined, orgId);
      }
      yield* state.ensureHydrated(orgId);
      yield* state.invalidateOrgInventories(orgId);
      yield* state.persistOrg(orgId);
    });

    const listMetadataTypes = Effect.fn('OrgMetadataCatalog.listMetadataTypes')(function* () {
      return yield* getChildren();
    });

    const listMetadataComponents = Effect.fn('OrgMetadataCatalog.listMetadataComponents')(function* (
      reference: OrgMetadataReference & { readonly xmlName: string }
    ) {
      return yield* getChildren(reference);
    });

    const refreshMetadataTypes = Effect.fn('OrgMetadataCatalog.refreshMetadataTypes')(function* () {
      yield* refresh();
      return yield* listMetadataTypes();
    });

    const refreshMetadataComponents = Effect.fn('OrgMetadataCatalog.refreshMetadataComponents')(function* (
      reference: OrgMetadataReference & { readonly xmlName: string }
    ) {
      yield* refresh(reference);
      return yield* listMetadataComponents(reference);
    });

    return {
      getChildren,
      getChildrenCached,
      getDocumentReference,
      getDocumentUri,
      getEntry,
      getPresence,
      getRemoteDocument,
      getSObjectCached,
      getSObjectsCached,
      getTrackingObservationsCached,
      getWorkspaceMetadataTypes,
      invalidate,
      invalidateReferences,
      listMetadataComponents,
      listMetadataTypes,
      materializeRemoteSource,
      materializeRemoteSources,
      read,
      readDocumentUri,
      resolveKnownOrgComponents,
      refresh,
      refreshMetadataComponents,
      refreshMetadataTypes
    };
  })
}) {}
