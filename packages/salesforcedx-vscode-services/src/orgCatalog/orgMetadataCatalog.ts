/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable barrel-files/avoid-barrel-files -- preserve the existing public catalog module while internals are decomposed */

import type { OrgMetadataConsistency } from './orgMetadataCatalogTypes';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ComponentSetService } from '../core/componentSetService';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { MetadataRegistryService } from '../core/metadataRegistryService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { SourceTrackingService } from '../core/sourceTrackingService';
import { TransmogrifierService } from '../core/transmogrifierService';
import { FsService } from '../vscode/fsService';
import { makeOrgCatalogDocuments } from './orgCatalogDocuments';
import { FOLDERED_METADATA_TYPES, makeOrgCatalogInventory } from './orgCatalogInventory';
import { makeOrgCatalogRemoteRetrieve } from './orgCatalogRemoteRetrieve';
import { makeOrgCatalogRemoteSource } from './orgCatalogRemoteSource';
import { makeOrgCatalogSObjects } from './orgCatalogSObjects';
import { makeOrgCatalogState } from './orgCatalogState';
import { makeOrgCatalogTracking, type OrgCatalogTrackingOptions } from './orgCatalogTracking';
import { makeOrgCatalogTreeProjection } from './orgCatalogTreeProjection';
import { makeOrgCatalogWorkspace } from './orgCatalogWorkspace';
import { OrgMetadataCatalogChangePubSub } from './orgMetadataCatalogChangePubSub';
import { OrgMetadataCatalogStore } from './orgMetadataCatalogStore';
import {
  type OrgMetadataComponentReference,
  type OrgMetadataReference,
  orgMetadataDocumentUri,
  parseOrgMetadataDocumentUri
} from './orgMetadataReference';
import { OrgMetadataShadowStore } from './orgMetadataShadowStore';

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
    ComponentSetService.Default,
    ConnectionService.Default,
    FsService.Default,
    MetadataDescribeService.Default,
    MetadataRegistryService.Default,
    MetadataRetrieveService.Default,
    OrgMetadataCatalogChangePubSub.Default,
    OrgMetadataCatalogStore.Default,
    OrgMetadataShadowStore.Default,
    ProjectService.Default,
    SourceTrackingService.Default,
    TransmogrifierService.Default
  ],
  effect: Effect.gen(function* () {
    const [
      componentSetService,
      connectionService,
      fsService,
      metadataDescribeService,
      metadataRegistryService,
      metadataRetrieveService,
      catalogChanges,
      catalogStore,
      shadowStore,
      projectService,
      sourceTrackingService,
      transmogrifierService
    ] = yield* Effect.all([
      ComponentSetService,
      ConnectionService,
      FsService,
      MetadataDescribeService,
      MetadataRegistryService,
      MetadataRetrieveService,
      OrgMetadataCatalogChangePubSub,
      OrgMetadataCatalogStore,
      OrgMetadataShadowStore,
      ProjectService,
      SourceTrackingService,
      TransmogrifierService
    ]);
    const state = yield* makeOrgCatalogState(catalogStore);
    const registryAccess = yield* metadataRegistryService.getRegistryAccess();
    const entryUri = (orgId: string, xmlName: string, fullName: string): URI =>
      orgMetadataDocumentUri(registryAccess, { orgId, xmlName, fullName: fullName || '__type__' });
    const workspace = makeOrgCatalogWorkspace({
      state,
      projectService,
      metadataRetrieveService,
      remoteDocumentUri: (orgId, reference) => orgMetadataDocumentUri(registryAccess, { orgId, ...reference })
    });
    const sobjects = makeOrgCatalogSObjects({ state, metadataDescribeService, transmogrifierService });
    const inventories = makeOrgCatalogInventory({ state, workspace, metadataDescribeService, entryUri });
    const treeProjection = makeOrgCatalogTreeProjection({
      inventories,
      sobjects,
      workspace,
      metadataDescribeService,
      entryUri
    });
    const remoteRetrieve = makeOrgCatalogRemoteRetrieve({
      componentSetService,
      fsService,
      metadataRetrieveService,
      shadowStore,
      documentUri: (orgId, reference) => orgMetadataDocumentUri(registryAccess, { orgId, ...reference }),
      getTypeSuffix: xmlName => registryAccess.getTypeByName(xmlName).suffix
    });
    const remoteSource = yield* makeOrgCatalogRemoteSource({
      connectionService,
      fsService,
      inventories,
      remoteRetrieve,
      shadowStore,
      state,
      documentUri: (orgId, reference) => orgMetadataDocumentUri(registryAccess, { orgId, ...reference })
    });
    const documents = makeOrgCatalogDocuments({
      fsService,
      inventories,
      remoteSource,
      documentUri: (orgId, reference) => orgMetadataDocumentUri(registryAccess, { orgId, ...reference }),
      parseDocumentUri: uri => parseOrgMetadataDocumentUri(registryAccess, uri)
    });
    const tracking = makeOrgCatalogTracking({ sourceTrackingService, state });
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
      return yield* tracking.hasChangeTracking();
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
      yield* metadataRetrieveService.retrieve([{ type: reference.xmlName, fullName: reference.fullName }], {
        ignoreConflicts: true
      });
      yield* invalidateReferences([reference]);
      return yield* getDocumentUri(reference);
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
            ? metadataDescribeService.invalidateAllListMetadata()
            : metadataDescribeService.invalidateListMetadata(xmlName),
        { discard: true }
      );
      const affectedSObjects = new Set<string>();
      references.forEach(reference => {
        if (reference.xmlName === 'CustomObject') affectedSObjects.add(reference.fullName);
        if (reference.xmlName === 'CustomField') affectedSObjects.add(reference.fullName.split('.')[0]);
      });
      if (affectedSObjects.size > 0) {
        yield* metadataDescribeService.invalidateSObjectDescribes([...affectedSObjects]);
        yield* metadataDescribeService.invalidateListSObjects();
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
      if (!reference.xmlName) {
        yield* metadataDescribeService.invalidateDescribe();
      } else if (FOLDERED_METADATA_TYPES.has(reference.xmlName)) {
        yield* metadataDescribeService.invalidateAllListMetadata();
      } else {
        yield* metadataDescribeService.invalidateListMetadata(reference.xmlName);
      }
      yield* invalidate();
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
