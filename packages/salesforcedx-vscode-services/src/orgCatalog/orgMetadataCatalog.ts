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
import * as PubSub from 'effect/PubSub';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { OrgCatalogDocuments } from './orgCatalogDocuments';
import { FOLDERED_METADATA_TYPES, OrgCatalogInventory } from './orgCatalogInventory';
import { OrgCatalogRemoteSource } from './orgCatalogRemoteSource';
import { OrgCatalogSObjects } from './orgCatalogSObjects';
import { OrgCatalogState } from './orgCatalogState';
import { OrgCatalogTracking, type OrgCatalogTrackingOptions } from './orgCatalogTracking';
import { OrgCatalogTreeProjection } from './orgCatalogTreeProjection';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace';
import { OrgMetadataCatalogChangePubSub } from './orgMetadataCatalogChangePubSub';

export {
  OrgCatalogObservationSchema,
  OrgMetadataChangeStatusSchema,
  OrgSObjectDescriptionSchema,
  OrgSObjectSummarySchema
} from './orgMetadataCatalogTypes';
export { OrgMetadataCatalogError } from './orgMetadataCatalogErrors';
export type {
  KnownOrgMetadataComponentResolution,
  OrgCatalogObservation,
  OrgMetadataCatalogEntry,
  OrgMetadataChangeStatus,
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
    MetadataRetrieveService.Default,
    OrgCatalogDocuments.Default,
    OrgCatalogInventory.Default,
    OrgCatalogRemoteSource.Default,
    OrgCatalogSObjects.Default,
    OrgCatalogState.Default,
    OrgCatalogTracking.Default,
    OrgCatalogTreeProjection.Default,
    OrgCatalogWorkspace.Default,
    OrgMetadataCatalogChangePubSub.Default
  ],
  effect: Effect.gen(function* () {
    const [
      connectionService,
      metadataDescribeService,
      metadataRetrieveService,
      documents,
      inventories,
      remoteSource,
      sobjects,
      state,
      tracking,
      treeProjection,
      workspace,
      catalogChanges
    ] = yield* Effect.all([
      ConnectionService,
      MetadataDescribeService,
      MetadataRetrieveService,
      OrgCatalogDocuments,
      OrgCatalogInventory,
      OrgCatalogRemoteSource,
      OrgCatalogSObjects,
      OrgCatalogState,
      OrgCatalogTracking,
      OrgCatalogTreeProjection,
      OrgCatalogWorkspace,
      OrgMetadataCatalogChangePubSub
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

    const listSObjects = Effect.fn('OrgMetadataCatalog.listSObjects')(function* () {
      const orgId = yield* getActiveOrgId();
      return yield* sobjects.listSObjects(orgId);
    });

    const describeSObject = Effect.fn('OrgMetadataCatalog.describeSObject')(function* (apiName: string) {
      const orgId = yield* getActiveOrgId();
      return yield* sobjects.describeSObject(orgId, apiName);
    });

    const describeSObjects = Effect.fn('OrgMetadataCatalog.describeSObjects')(function* (apiNames: readonly string[]) {
      const orgId = yield* getActiveOrgId();
      return yield* sobjects.describeSObjects(orgId, apiNames);
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

    const hasChangeTracking = Effect.fn('OrgMetadataCatalog.hasChangeTracking')(function* () {
      return yield* tracking.hasChangeTracking(yield* getActiveOrgId());
    });

    const getChangeStatus = Effect.fn('OrgMetadataCatalog.getChangeStatus')(function* (
      options: OrgCatalogTrackingOptions
    ) {
      return yield* tracking.getChangeStatus(yield* getActiveOrgId(), options);
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

    const download = Effect.fn('OrgMetadataCatalog.download')(function* (reference: OrgMetadataComponentReference) {
      const orgId = yield* getActiveOrgId();
      yield* metadataRetrieveService.retrieve([{ type: reference.xmlName, fullName: reference.fullName }], {
        ignoreConflicts: true,
        expectedOrgId: orgId
      });
      yield* invalidateReferencesInternal(orgId, [reference], true);
      return yield* documents.getDocumentUri(orgId, reference);
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

    const refreshChangeStatus = Effect.fn('OrgMetadataCatalog.refreshChangeStatus')(function* (
      options: OrgCatalogTrackingOptions
    ) {
      const orgId = yield* getActiveOrgId();
      yield* state.ensureHydrated(orgId);
      const { changedReferences, observations, status } = yield* tracking.observeChangeStatus(orgId, options);
      if (observations && changedReferences.length > 0) {
        yield* invalidateReferencesInternal(orgId, changedReferences, false);
        yield* tracking.commitObservations(orgId, observations);
        yield* state.persistOrg(orgId);
        yield* PubSub.publish(catalogChanges, {
          kind: 'tracking',
          orgId,
          references: changedReferences
        });
      }
      return status;
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

    const refreshSObjects = Effect.fn('OrgMetadataCatalog.refreshSObjects')(function* (apiNames?: readonly string[]) {
      const orgId = yield* getActiveOrgId();
      return yield* sobjects.refreshSObjects(orgId, apiNames);
    });

    const refreshSObject = Effect.fn('OrgMetadataCatalog.refreshSObject')(function* (apiName: string) {
      const orgId = yield* getActiveOrgId();
      return yield* sobjects.refreshSObject(orgId, apiName);
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
      describeSObject,
      describeSObjects,
      download,
      getChildren,
      getChildrenCached,
      getChangeStatus,
      getDocumentReference,
      getDocumentUri,
      getEntry,
      getPresence,
      getRemoteDocument,
      getWorkspaceMetadataTypes,
      hasChangeTracking,
      invalidate,
      invalidateReferences,
      listMetadataComponents,
      listMetadataTypes,
      listSObjects,
      materializeRemoteSource,
      materializeRemoteSources,
      read,
      readDocumentUri,
      resolveKnownOrgComponents,
      refresh,
      refreshChangeStatus,
      refreshMetadataComponents,
      refreshMetadataTypes,
      refreshSObject,
      refreshSObjects
    };
  })
}) {}
