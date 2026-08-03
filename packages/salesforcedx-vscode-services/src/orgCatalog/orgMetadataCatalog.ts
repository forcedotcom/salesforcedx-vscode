/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../core/componentSetService';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { MetadataRegistryService } from '../core/metadataRegistryService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { unknownToErrorCause } from '../core/shared';
import { SourceTrackingService } from '../core/sourceTrackingService';
import { SObjectSchema, TransmogrifierService } from '../core/transmogrifierService';
import { FsService } from '../vscode/fsService';
import { OrgMetadataCatalogChangePubSub } from './orgMetadataCatalogChangePubSub';
import {
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot,
  type PersistedTypeInventory
} from './orgMetadataCatalogStore';
import {
  isOrgMetadataComponentReference,
  type OrgMetadataComponentReference,
  type OrgMetadataReference,
  orgMetadataDocumentUri,
  parseOrgMetadataDocumentUri
} from './orgMetadataReference';
import { OrgMetadataShadowStore, type OrgMetadataShadowArtifact } from './orgMetadataShadowStore';

const FOLDERED_METADATA_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);

export type OrgMetadataPresence = {
  readonly inOrg: boolean;
  readonly inWorkspace: boolean;
  readonly workspaceUri?: URI;
};

export type OrgMetadataConsistency = 'cache-first' | 'refresh';

export type KnownOrgMetadataComponentResolution = {
  readonly reference: OrgMetadataComponentReference;
  readonly documentUri: URI;
  readonly inWorkspace: boolean;
  readonly workspaceUri?: URI;
};

export const OrgCatalogObservationSchema = Schema.Struct({
  orgId: Schema.String,
  observedAt: Schema.String,
  provenance: Schema.Literal(
    'metadata-api',
    'rest-api',
    'tooling-api',
    'workspace',
    'metadata-api+workspace',
    'source-tracking'
  ),
  remoteLastModifiedDate: Schema.optional(Schema.String)
});
export type OrgCatalogObservation = typeof OrgCatalogObservationSchema.Type;

export const OrgSObjectSummarySchema = Schema.Struct({
  ...OrgCatalogObservationSchema.fields,
  name: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean
});
export type OrgSObjectSummary = typeof OrgSObjectSummarySchema.Type;

export const OrgSObjectDescriptionSchema = Schema.Struct({
  ...SObjectSchema.fields,
  ...OrgCatalogObservationSchema.fields
});
export type OrgSObjectDescription = typeof OrgSObjectDescriptionSchema.Type;

export const OrgMetadataChangeStatusSchema = Schema.Struct({
  ...OrgCatalogObservationSchema.fields,
  fullName: Schema.String,
  type: Schema.String,
  origin: Schema.Literal('local', 'remote'),
  state: Schema.String,
  filePath: Schema.optional(Schema.String),
  conflict: Schema.optional(Schema.Boolean),
  ignored: Schema.optional(Schema.Boolean)
});
export type OrgMetadataChangeStatus = typeof OrgMetadataChangeStatusSchema.Type;

export type OrgMetadataEntryKind = 'type' | 'folder' | 'component';

export type OrgMetadataFieldDetails = {
  readonly name: string;
  readonly type: string;
  readonly length?: number;
  readonly relationshipName?: string | null;
  readonly scale?: number;
  readonly precision?: number;
};

export type OrgMetadataCatalogEntry = OrgMetadataPresence & {
  readonly orgId: string;
  readonly observedAt: string;
  readonly provenance: OrgCatalogObservation['provenance'];
  readonly reference: OrgMetadataReference;
  readonly name: string;
  readonly kind: OrgMetadataEntryKind;
  readonly documentUri: URI;
  readonly namespacePrefix?: string;
  readonly manageableState?: string;
  readonly fileName?: string;
  readonly lastModifiedByName?: string;
  readonly lastModifiedDate?: string;
  readonly remoteLastModifiedDate?: string;
  readonly field?: OrgMetadataFieldDetails;
};

type ListedMetadataComponent = {
  readonly fullName: string;
  readonly namespacePrefix?: string;
  readonly manageableState?: string;
  readonly fileName?: string;
  readonly lastModifiedByName?: string;
  readonly lastModifiedDate?: string;
};

type TypeInventory = {
  readonly observedAt: string;
  readonly components: ReadonlyMap<string, OrgMetadataCatalogEntry>;
  readonly folders: ReadonlyMap<string, ListedMetadataComponent>;
};

type InventoryCache = ReadonlyMap<string, TypeInventory>;
type PersistedInventoryCache = ReadonlyMap<string, PersistedTypeInventory>;

type RemoteTrackingObservation = {
  readonly reference: OrgMetadataComponentReference;
  readonly signature: string;
};

export class OrgMetadataCatalogError extends Data.TaggedError('OrgMetadataCatalogError')<{
  readonly cause: Error;
  readonly message: string;
  readonly reference?: OrgMetadataReference;
}> {}

const emptyPresence = (): OrgMetadataPresence => ({ inOrg: false, inWorkspace: false });
const typeCacheKey = (orgId: string, xmlName: string): string => `${orgId}\0${xmlName}`;
const sobjectDescriptionKey = (orgId: string, apiName: string): string => `${orgId}\0${apiName}`;
const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const mergeInventory = ({
  entryUri,
  orgId,
  xmlName,
  orgComponents,
  workspaceUris,
  observedAt
}: {
  readonly entryUri: (orgId: string, xmlName: string, fullName: string) => URI;
  readonly orgId: string;
  readonly xmlName: string;
  readonly orgComponents: readonly ListedMetadataComponent[];
  readonly workspaceUris: ReadonlyMap<string, URI>;
  readonly observedAt: string;
}): ReadonlyMap<string, OrgMetadataCatalogEntry> => {
  const orgInventory = orgComponents.reduce(
    (entries, component) =>
      entries.set(component.fullName, {
        orgId,
        observedAt,
        provenance: 'metadata-api',
        reference: { xmlName, fullName: component.fullName },
        documentUri: entryUri(orgId, xmlName, component.fullName),
        name: component.fullName.split('/').at(-1) ?? component.fullName,
        kind: 'component',
        namespacePrefix: component.namespacePrefix,
        manageableState: component.manageableState,
        fileName: component.fileName,
        lastModifiedByName: component.lastModifiedByName,
        lastModifiedDate: component.lastModifiedDate,
        remoteLastModifiedDate: component.lastModifiedDate,
        inOrg: true,
        inWorkspace: false
      }),
    new Map<string, OrgMetadataCatalogEntry>()
  );
  return [...workspaceUris].reduce((entries, [fullName, workspaceUri]) => {
    const existing = entries.get(fullName);
    return entries.set(fullName, {
      orgId,
      observedAt: existing?.observedAt ?? new Date().toISOString(),
      provenance: existing ? 'metadata-api+workspace' : 'workspace',
      reference: { xmlName, fullName },
      documentUri: existing?.documentUri ?? entryUri(orgId, xmlName, fullName),
      name: existing?.name ?? fullName.split('/').at(-1) ?? fullName,
      kind: 'component',
      namespacePrefix: existing?.namespacePrefix,
      manageableState: existing?.manageableState,
      fileName: existing?.fileName,
      lastModifiedByName: existing?.lastModifiedByName,
      lastModifiedDate: existing?.lastModifiedDate,
      remoteLastModifiedDate: existing?.remoteLastModifiedDate,
      inOrg: existing?.inOrg ?? false,
      inWorkspace: true,
      workspaceUri
    });
  }, orgInventory);
};

const projectChildren = (
  entryUri: (orgId: string, xmlName: string, fullName: string) => URI,
  orgId: string,
  xmlName: string,
  parentFullName: string | undefined,
  inventory: TypeInventory
): OrgMetadataCatalogEntry[] => {
  const prefix = parentFullName ? `${parentFullName}/` : '';
  const childNames = new Set<string>();
  [...inventory.components.keys(), ...inventory.folders.keys()].forEach(fullName => {
    if (!fullName.startsWith(prefix)) return;
    const name = fullName.slice(prefix.length).split('/')[0];
    if (name) childNames.add(name);
  });
  return [...childNames]
    .map(name => {
      const fullName = `${prefix}${name}`;
      const component = inventory.components.get(fullName);
      const folder = inventory.folders.get(fullName);
      const hasDescendants = [...inventory.components.keys(), ...inventory.folders.keys()].some(candidate =>
        candidate.startsWith(`${fullName}/`)
      );
      if (!folder && !hasDescendants && component) return { ...component, name };
      const descendants = [...inventory.components.values()].filter(
        entry => isOrgMetadataComponentReference(entry.reference) && entry.reference.fullName.startsWith(`${fullName}/`)
      );
      return {
        orgId,
        observedAt: inventory.observedAt,
        provenance:
          folder !== undefined || descendants.some(entry => entry.inOrg)
            ? descendants.some(entry => entry.inWorkspace)
              ? ('metadata-api+workspace' as const)
              : ('metadata-api' as const)
            : ('workspace' as const),
        reference: { xmlName, fullName },
        documentUri: entryUri(orgId, xmlName, fullName),
        name,
        kind: 'folder' as const,
        namespacePrefix: folder?.namespacePrefix,
        manageableState: folder?.manageableState,
        lastModifiedByName: folder?.lastModifiedByName,
        lastModifiedDate: folder?.lastModifiedDate,
        remoteLastModifiedDate: folder?.lastModifiedDate,
        inOrg: folder !== undefined || descendants.some(entry => entry.inOrg),
        inWorkspace: descendants.some(entry => entry.inWorkspace)
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));
};

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
    const inventoryCache = yield* Ref.make<InventoryCache>(new Map());
    const persistedInventoryCache = yield* Ref.make<PersistedInventoryCache>(new Map());
    const inventorySemaphores = yield* Ref.make<ReadonlyMap<string, Effect.Semaphore>>(new Map());
    const remoteTrackingCache = yield* Ref.make<ReadonlyMap<string, ReadonlyMap<string, RemoteTrackingObservation>>>(
      new Map()
    );
    const workspaceTypeCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
    const sobjectListCache = yield* Ref.make<ReadonlyMap<string, readonly OrgSObjectSummary[]>>(new Map());
    const sobjectDescriptionCache = yield* Ref.make<ReadonlyMap<string, OrgSObjectDescription>>(new Map());
    const hydratedOrgIds = yield* Ref.make<ReadonlySet<string>>(new Set());
    const persistedGenerations = yield* Ref.make<ReadonlyMap<string, number>>(new Map());
    const hydrateSemaphore = yield* Effect.makeSemaphore(1);
    const materializeSemaphore = yield* Effect.makeSemaphore(1);
    const registryAccess = yield* metadataRegistryService.getRegistryAccess();
    const entryUri = (orgId: string, xmlName: string, fullName: string): URI =>
      orgMetadataDocumentUri(registryAccess, { orgId, xmlName, fullName: fullName || '__type__' });
    const persistOrg = Effect.fn('OrgMetadataCatalog.persistOrg')(function* (orgId: string) {
      const [loadedInventory, restoredInventory, sobjectLists, sobjectDescriptions, trackingByOrg] = yield* Effect.all([
        Ref.get(inventoryCache),
        Ref.get(persistedInventoryCache),
        Ref.get(sobjectListCache),
        Ref.get(sobjectDescriptionCache),
        Ref.get(remoteTrackingCache)
      ]);
      const inventory = new Map<string, PersistedTypeInventory>();
      restoredInventory.forEach((value, key) => {
        if (key.startsWith(`${orgId}\0`)) inventory.set(value.xmlName, value);
      });
      loadedInventory.forEach((value, key) => {
        if (!key.startsWith(`${orgId}\0`)) return;
        const xmlName = key.slice(orgId.length + 1);
        const remoteComponents = [...value.components.values()].filter(component => component.inOrg);
        inventory.set(xmlName, {
          xmlName,
          observedAt: value.observedAt,
          components: remoteComponents.map(component => ({
            fullName: isOrgMetadataComponentReference(component.reference)
              ? component.reference.fullName
              : component.name,
            namespacePrefix: component.namespacePrefix,
            manageableState: component.manageableState,
            fileName: component.fileName,
            lastModifiedByName: component.lastModifiedByName,
            lastModifiedDate: component.lastModifiedDate
          })),
          folders: [...value.folders.values()]
        });
      });
      const generation = yield* Ref.modify(persistedGenerations, generations => {
        const next = (generations.get(orgId) ?? 0) + 1;
        return [next, new Map(generations).set(orgId, next)];
      });
      const snapshot: OrgMetadataCatalogSnapshot = {
        version: 1,
        orgId,
        writtenAt: new Date().toISOString(),
        generation,
        inventory: [...inventory.values()].toSorted((left, right) => left.xmlName.localeCompare(right.xmlName)),
        sobjects: {
          list: sobjectLists.get(orgId),
          descriptions: [...sobjectDescriptions]
            .filter(([key]) => key.startsWith(`${orgId}\0`))
            .map(([, description]) => description)
            .toSorted((left, right) => left.name.localeCompare(right.name))
        },
        tracking: [...(trackingByOrg.get(orgId) ?? new Map()).values()]
          .map(observation => ({
            xmlName: observation.reference.xmlName,
            fullName: observation.reference.fullName,
            signature: observation.signature
          }))
          .toSorted((left, right) => {
            const typeComparison = left.xmlName.localeCompare(right.xmlName);
            return typeComparison === 0 ? left.fullName.localeCompare(right.fullName) : typeComparison;
          })
      };
      yield* catalogStore
        .save(snapshot)
        .pipe(Effect.catchAll(error => Effect.logWarning('Failed to persist org metadata catalog', error)));
    });

    const ensureHydrated = Effect.fn('OrgMetadataCatalog.ensureHydrated')(function* (orgId: string) {
      if ((yield* Ref.get(hydratedOrgIds)).has(orgId)) return;
      yield* hydrateSemaphore.withPermits(1)(
        Effect.gen(function* () {
          if ((yield* Ref.get(hydratedOrgIds)).has(orgId)) return;
          const snapshot = yield* catalogStore
            .load(orgId)
            .pipe(
              Effect.catchAll(error =>
                Effect.logWarning('Failed to hydrate org metadata catalog', error).pipe(Effect.as(undefined))
              )
            );
          if (snapshot) {
            yield* Ref.update(persistedInventoryCache, current => {
              const next = new Map(current);
              snapshot.inventory.forEach(inventory => next.set(typeCacheKey(orgId, inventory.xmlName), inventory));
              return next;
            });
            if (snapshot.sobjects.list) {
              yield* Ref.update(sobjectListCache, current => new Map(current).set(orgId, snapshot.sobjects.list ?? []));
            }
            yield* Ref.update(sobjectDescriptionCache, current => {
              const next = new Map(current);
              snapshot.sobjects.descriptions.forEach(description =>
                next.set(sobjectDescriptionKey(orgId, description.name), description)
              );
              return next;
            });
            yield* Ref.update(remoteTrackingCache, current =>
              new Map(current).set(
                orgId,
                new Map(
                  snapshot.tracking.map(observation => [
                    `${observation.xmlName}\0${observation.fullName}`,
                    {
                      reference: { xmlName: observation.xmlName, fullName: observation.fullName },
                      signature: observation.signature
                    }
                  ])
                )
              )
            );
            yield* Ref.update(persistedGenerations, current => new Map(current).set(orgId, snapshot.generation));
          }
          yield* Ref.update(hydratedOrgIds, current => new Set(current).add(orgId));
        })
      );
    });

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

    const assertActiveOrg = Effect.fn('OrgMetadataCatalog.assertActiveOrg')(function* (orgId: string) {
      const activeOrgId = yield* getActiveOrgId();
      if (activeOrgId !== orgId) {
        return yield* Effect.fail(
          vscode.FileSystemError.FileNotFound(`Metadata document belongs to inactive org ${orgId}`)
        );
      }
    });

    const scanWorkspace = Effect.fn('OrgMetadataCatalog.scanWorkspace')(function* (xmlName: string) {
      const project = yield* projectService.getSfProject();
      const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
      const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, [
        { type: xmlName, fullName: '*' }
      ]);
      return [...componentSet.getSourceComponents()].reduce((workspaceUris, component) => {
        if (component.type.name !== xmlName) return workspaceUris;
        // Decomposed child metadata (for example CustomField) has an XML source file but no
        // `content` path. Treat the XML path as its workspace artifact so local presence is not
        // lost merely because the registry represents the component as a child of its container.
        const sourcePath = component.content ?? component.xml;
        if (!sourcePath) return workspaceUris;
        const candidate = URI.file(sourcePath);
        const existing = workspaceUris.get(component.fullName);
        if (!existing || candidate.path.length < existing.path.length) {
          workspaceUris.set(component.fullName, candidate);
        }
        return workspaceUris;
      }, new Map<string, URI>());
    });

    /**
     * Resolves navigation and workspace presence for components that a consumer has already discovered
     * in the active org. This deliberately avoids Metadata API inventory acquisition: the caller's
     * discovery result is authoritative for org presence, while the catalog remains authoritative for
     * workspace correlation and document projection.
     */
    const resolveKnownOrgComponents = Effect.fn('OrgMetadataCatalog.resolveKnownOrgComponents')(function* (
      references: readonly OrgMetadataComponentReference[]
    ) {
      const orgId = yield* getActiveOrgId();
      const xmlNames = [...new Set(references.map(reference => reference.xmlName))];
      const workspaceByType = new Map(
        yield* Effect.forEach(
          xmlNames,
          xmlName =>
            scanWorkspace(xmlName).pipe(
              Effect.catchAll(error =>
                Effect.logWarning('Failed to resolve workspace metadata presence', { error, xmlName }).pipe(
                  Effect.as(new Map<string, URI>())
                )
              ),
              Effect.map(workspaceUris => [xmlName, workspaceUris] as const)
            ),
          { concurrency: 10 }
        )
      );
      const resolutions = references.map(reference => {
        const workspaceUri = workspaceByType.get(reference.xmlName)?.get(reference.fullName);
        return {
          reference,
          documentUri: workspaceUri ?? orgMetadataDocumentUri(registryAccess, { orgId, ...reference }),
          inWorkspace: workspaceUri !== undefined,
          ...(workspaceUri ? { workspaceUri } : {})
        } satisfies KnownOrgMetadataComponentResolution;
      });
      yield* Effect.annotateCurrentSpan({
        componentCount: references.length,
        metadataTypeCount: xmlNames.length,
        workspaceComponentCount: resolutions.filter(resolution => resolution.inWorkspace).length
      });
      return resolutions;
    });

    const getInventorySemaphore = Effect.fn('OrgMetadataCatalog.getInventorySemaphore')(function* (key: string) {
      const existing = (yield* Ref.get(inventorySemaphores)).get(key);
      if (existing) return existing;
      const candidate = yield* Effect.makeSemaphore(1);
      return yield* Ref.modify(inventorySemaphores, current => {
        const concurrent = current.get(key);
        return concurrent ? [concurrent, current] : [candidate, new Map(current).set(key, candidate)];
      });
    });

    const withInventorySemaphores = <A, E, R>(
      semaphores: readonly Effect.Semaphore[],
      effect: Effect.Effect<A, E, R>
    ) => semaphores.reduceRight((guarded, semaphore) => semaphore.withPermits(1)(guarded), effect);

    const loadType = Effect.fn('OrgMetadataCatalog.loadType')(function* (xmlName: string) {
      const orgId = yield* getActiveOrgId();
      yield* ensureHydrated(orgId);
      const key = typeCacheKey(orgId, xmlName);
      const cached = (yield* Ref.get(inventoryCache)).get(key);
      if (cached) return cached;
      const semaphore = yield* getInventorySemaphore(key);
      return yield* semaphore.withPermits(1)(
        Effect.gen(function* () {
          const coalesced = (yield* Ref.get(inventoryCache)).get(key);
          if (coalesced) return coalesced;
          const restored = (yield* Ref.get(persistedInventoryCache)).get(key);
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
              scanWorkspace(xmlName).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, URI>())))
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
          };
          yield* Ref.update(inventoryCache, current => new Map(current).set(key, inventory));
          if (!restored) yield* persistOrg(orgId);
          return inventory;
        })
      );
    });

    const getPresence = Effect.fn('OrgMetadataCatalog.getPresence')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const entry = (yield* loadType(reference.xmlName)).components.get(reference.fullName);
      return entry
        ? {
            inOrg: entry.inOrg,
            inWorkspace: entry.inWorkspace,
            ...(entry.workspaceUri ? { workspaceUri: entry.workspaceUri } : {})
          }
        : emptyPresence();
    });

    const getWorkspaceMetadataTypes = Effect.fn('OrgMetadataCatalog.getWorkspaceMetadataTypes')(function* () {
      const orgId = yield* getActiveOrgId();
      const cached = (yield* Ref.get(workspaceTypeCache)).get(orgId);
      if (cached) return cached;
      const types = yield* Effect.gen(function* () {
        const project = yield* projectService.getSfProject();
        const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
        const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, []);
        return new Set([...componentSet.getSourceComponents()].map(component => component.type.name));
      }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())));
      yield* Ref.update(workspaceTypeCache, current => new Map(current).set(orgId, types));
      return types;
    });

    const listSObjects = Effect.fn('OrgMetadataCatalog.listSObjects')(function* () {
      const orgId = yield* getActiveOrgId();
      yield* ensureHydrated(orgId);
      const cached = (yield* Ref.get(sobjectListCache)).get(orgId);
      if (cached) return cached;
      const observedAt = new Date().toISOString();
      const observations = (yield* metadataDescribeService.listSObjects()).map(sobject => ({
        ...sobject,
        orgId,
        observedAt,
        provenance: 'rest-api' as const
      }));
      yield* Ref.update(sobjectListCache, current => new Map(current).set(orgId, observations));
      yield* persistOrg(orgId);
      return observations;
    });

    const describeSObject = Effect.fn('OrgMetadataCatalog.describeSObject')(function* (apiName: string) {
      const orgId = yield* getActiveOrgId();
      yield* ensureHydrated(orgId);
      const key = sobjectDescriptionKey(orgId, apiName);
      const cached = (yield* Ref.get(sobjectDescriptionCache)).get(key);
      if (cached) return cached;
      const description = yield* metadataDescribeService.describeCustomObject(apiName).pipe(
        Effect.flatMap(transmogrifierService.toMinimalSObject),
        Effect.map(sobject => ({
          ...sobject,
          orgId,
          observedAt: new Date().toISOString(),
          provenance: 'rest-api' as const
        }))
      );
      yield* Ref.update(sobjectDescriptionCache, current => new Map(current).set(key, description));
      yield* persistOrg(orgId);
      return description;
    });

    const reacquireSObjectDescription = Effect.fn('OrgMetadataCatalog.reacquireSObjectDescription')(function* (
      apiName: string
    ) {
      const orgId = yield* getActiveOrgId();
      yield* metadataDescribeService.invalidateSObjectDescribe(apiName);
      yield* Ref.update(sobjectDescriptionCache, current => {
        const next = new Map(current);
        next.delete(sobjectDescriptionKey(orgId, apiName));
        return next;
      });
      return yield* describeSObject(apiName);
    });

    const describeSObjects = Effect.fn('OrgMetadataCatalog.describeSObjects')(function* (apiNames: readonly string[]) {
      const orgId = yield* getActiveOrgId();
      yield* ensureHydrated(orgId);
      const cachedDescriptions = yield* Ref.get(sobjectDescriptionCache);
      const cached = apiNames.flatMap(apiName => {
        const description = cachedDescriptions.get(sobjectDescriptionKey(orgId, apiName));
        return description ? [description] : [];
      });
      const missing = apiNames.filter(apiName => !cachedDescriptions.has(sobjectDescriptionKey(orgId, apiName)));
      if (missing.length === 0) return Stream.fromIterable(cached);
      const descriptions = yield* metadataDescribeService.describeCustomObjects([...missing]);
      const acquired = descriptions.pipe(
        Stream.mapEffect(transmogrifierService.toMinimalSObject),
        Stream.map(sobject => ({
          ...sobject,
          orgId,
          observedAt: new Date().toISOString(),
          provenance: 'rest-api' as const
        })),
        Stream.tap(description =>
          Ref.update(sobjectDescriptionCache, current =>
            new Map(current).set(sobjectDescriptionKey(orgId, description.name), description)
          )
        ),
        Stream.ensuring(persistOrg(orgId))
      );
      return Stream.fromIterable(cached).pipe(Stream.concat(acquired));
    });

    const getCustomFieldChildren = Effect.fn('OrgMetadataCatalog.getCustomFieldChildren')(function* (
      objectEntry: OrgMetadataCatalogEntry
    ) {
      if (!isOrgMetadataComponentReference(objectEntry.reference)) return [];
      const orgId = yield* getActiveOrgId();
      const objectApiName = objectEntry.namespacePrefix
        ? `${objectEntry.namespacePrefix}__${objectEntry.reference.fullName}`
        : objectEntry.reference.fullName;
      const fieldInventory = yield* loadType('CustomField');
      const cachedDescription = yield* describeSObject(objectApiName);
      const describedObject =
        Date.parse(fieldInventory.observedAt) > Date.parse(cachedDescription.observedAt)
          ? yield* reacquireSObjectDescription(objectApiName).pipe(
              Effect.catchAll(error =>
                Effect.logWarning('Failed to refresh stale SObject description', error).pipe(
                  Effect.as(cachedDescription)
                )
              )
            )
          : cachedDescription;
      const parentNames = new Set([objectEntry.reference.fullName, objectApiName]);
      const inventoryFields = [...fieldInventory.components.values()].filter(entry => {
        if (!isOrgMetadataComponentReference(entry.reference)) return false;
        const separator = entry.reference.fullName.lastIndexOf('.');
        return separator > 0 && parentNames.has(entry.reference.fullName.slice(0, separator));
      });
      const describedFields = describedObject.fields.filter(field => field.custom);
      const describedByName = new Map<string, (typeof describedFields)[number]>();
      describedFields.forEach(field => {
        describedByName.set(field.name, field);
        if (objectEntry.namespacePrefix) {
          describedByName.set(field.name.replace(`${objectEntry.namespacePrefix}__`, ''), field);
        }
      });
      const toFieldDetails = (field: (typeof describedFields)[number], name: string) => ({
        name,
        type: field.type,
        length: field.length,
        relationshipName: field.relationshipName,
        scale: field.scale,
        precision: field.precision
      });
      const inventoryEntries = inventoryFields.map(entry => {
        const fullName = entry.reference.fullName!;
        const fieldName = fullName.slice(fullName.lastIndexOf('.') + 1);
        const unqualifiedName = objectEntry.namespacePrefix
          ? fieldName.replace(`${objectEntry.namespacePrefix}__`, '')
          : fieldName;
        const described = describedByName.get(fieldName) ?? describedByName.get(unqualifiedName);
        return {
          ...entry,
          name: unqualifiedName,
          namespacePrefix: objectEntry.namespacePrefix,
          ...(described ? { field: toFieldDetails(described, unqualifiedName) } : {})
        } satisfies OrgMetadataCatalogEntry;
      });
      const inventoriedFullNames = new Set(inventoryFields.map(entry => entry.reference.fullName));
      const describedOnlyEntries = describedFields.flatMap(field => {
        const unqualifiedName = objectEntry.namespacePrefix
          ? field.name.replace(`${objectEntry.namespacePrefix}__`, '')
          : field.name;
        const candidates = [
          `${objectEntry.reference.fullName}.${field.name}`,
          `${objectEntry.reference.fullName}.${unqualifiedName}`
        ];
        const fullName = candidates.find(candidate => fieldInventory.components.has(candidate)) ?? candidates[0];
        if (inventoriedFullNames.has(fullName)) return [];
        const existing = fieldInventory.components.get(fullName);
        return [
          {
            ...(existing ?? {
              orgId,
              observedAt: new Date().toISOString(),
              provenance: 'rest-api' as const,
              reference: { xmlName: 'CustomField', fullName },
              documentUri: entryUri(orgId, 'CustomField', fullName),
              kind: 'component' as const,
              inOrg: true,
              inWorkspace: false
            }),
            name: unqualifiedName,
            namespacePrefix: objectEntry.namespacePrefix,
            field: toFieldDetails(field, unqualifiedName)
          } satisfies OrgMetadataCatalogEntry
        ];
      });
      return [...inventoryEntries, ...describedOnlyEntries].toSorted((left, right) =>
        left.name.localeCompare(right.name)
      );
    });

    const getChildren = Effect.fn('OrgMetadataCatalog.getChildren')(function* (reference: OrgMetadataReference = {}) {
      const orgId = yield* getActiveOrgId();
      if (!reference.xmlName) {
        const [metadataTypes, workspaceTypes] = yield* Effect.all(
          [metadataDescribeService.describe(), getWorkspaceMetadataTypes()],
          { concurrency: 'unbounded' }
        );
        const orgTypes = new Set(metadataTypes.map(type => type.xmlName));
        return [...new Set([...orgTypes, ...workspaceTypes])]
          .map(xmlName => ({
            orgId,
            observedAt: new Date().toISOString(),
            provenance:
              orgTypes.has(xmlName) && workspaceTypes.has(xmlName)
                ? ('metadata-api+workspace' as const)
                : orgTypes.has(xmlName)
                  ? ('metadata-api' as const)
                  : ('workspace' as const),
            reference: { xmlName },
            documentUri: entryUri(orgId, xmlName, ''),
            name: xmlName,
            kind: 'type' as const,
            inOrg: orgTypes.has(xmlName),
            inWorkspace: workspaceTypes.has(xmlName)
          }))
          .toSorted((left, right) => left.name.localeCompare(right.name));
      }
      const inventory = yield* loadType(reference.xmlName);
      const component = reference.fullName ? inventory.components.get(reference.fullName) : undefined;
      if (component && reference.xmlName === 'CustomObject') {
        return yield* getCustomFieldChildren(component);
      }
      const children = projectChildren(entryUri, orgId, reference.xmlName, reference.fullName, inventory);
      if (children.length === 0 && reference.fullName) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(reference.fullName));
      }
      return children;
    });

    const getChildrenCached = Effect.fn('OrgMetadataCatalog.getChildrenCached')(function* (
      reference: OrgMetadataReference
    ) {
      if (!reference.xmlName) return undefined;
      const orgId = yield* getActiveOrgId();
      const inventory = (yield* Ref.get(inventoryCache)).get(typeCacheKey(orgId, reference.xmlName));
      return inventory ? projectChildren(entryUri, orgId, reference.xmlName, reference.fullName, inventory) : undefined;
    });

    const getEntry = Effect.fn('OrgMetadataCatalog.getEntry')(function* (reference: OrgMetadataComponentReference) {
      const orgId = yield* getActiveOrgId();
      const inventory = yield* loadType(reference.xmlName);
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

    const getDocumentUri = Effect.fn('OrgMetadataCatalog.getDocumentUri')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const presence = yield* getPresence(reference);
      if (!presence.inOrg && !presence.inWorkspace) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`));
      }
      return (
        presence.workspaceUri ??
        orgMetadataDocumentUri(registryAccess, {
          orgId: yield* getActiveOrgId(),
          ...reference
        })
      );
    });

    const fetchApexClass = Effect.fn('OrgMetadataCatalog.fetchApexClass')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const connection = yield* connectionService.getConnection();
      const nameParts = reference.fullName.split('.');
      const className = nameParts.at(-1) ?? reference.fullName;
      const namespace = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : undefined;
      const namespaceFilter = namespace ? ` AND NamespacePrefix = '${escapeSoql(namespace)}'` : '';
      const query = `SELECT Body, LastModifiedDate FROM ApexClass WHERE Name = '${escapeSoql(className)}'${namespaceFilter} LIMIT 1`;
      const result = yield* Effect.tryPromise({
        try: () => connection.tooling.query<{ Body?: string; LastModifiedDate?: string }>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new OrgMetadataCatalogError({
            cause,
            message: `Failed to retrieve Apex class '${reference.fullName}': ${cause.message}`,
            reference
          });
        }
      });
      const record = result.records[0];
      const body = record?.Body;
      if (body?.includes('(hidden)')) {
        return {
          content: `// Source code for managed class '${reference.fullName}' is protected.`,
          lastModifiedDate: record?.LastModifiedDate
        };
      }
      if (body) return { content: body, lastModifiedDate: record?.LastModifiedDate };
      return yield* new OrgMetadataCatalogError({
        cause: new Error('Apex class body was not returned'),
        message: `Apex class '${reference.fullName}' has no readable source body`,
        reference
      });
    });

    const listStagedFiles = Effect.fn('OrgMetadataCatalog.listStagedFiles')(function* (rootUri: URI) {
      const initial: { readonly pending: readonly URI[]; readonly files: readonly URI[] } = {
        pending: [rootUri],
        files: []
      };
      const result = yield* Effect.iterate(initial, {
        while: state => state.pending.length > 0,
        body: state =>
          fsService.readDirectoryWithTypes(state.pending[0]!).pipe(
            Effect.map(entries => ({
              pending: [
                ...state.pending.slice(1),
                ...entries.filter(entry => (entry.type & vscode.FileType.Directory) !== 0).map(entry => entry.uri)
              ],
              files: [
                ...state.files,
                ...entries.filter(entry => (entry.type & vscode.FileType.File) !== 0).map(entry => entry.uri)
              ]
            }))
          )
      });
      yield* Effect.annotateCurrentSpan('stagedFileCount', result.files.length);
      return result.files;
    });

    const materializeRetrievedComponent = Effect.fn('OrgMetadataCatalog.materializeRetrievedComponent')(function* (
      reference: OrgMetadataComponentReference,
      expectedRemoteLastModifiedDate?: string
    ) {
      const orgId = yield* getActiveOrgId();
      const { stagingUri } = yield* shadowStore.prepare(orgId, reference, expectedRemoteLastModifiedDate);
      const member = { type: reference.xmlName, fullName: reference.fullName };
      const componentSet = yield* metadataRetrieveService.buildComponentSet([member]);
      const nonEmptyComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
      return yield* metadataRetrieveService.retrieveComponentSetToDirectory(nonEmptyComponentSet, stagingUri).pipe(
        Effect.flatMap(result =>
          Effect.gen(function* () {
            const sourceComponent = [...result.components.getSourceComponents()].find(
              component => component.type.name === reference.xmlName && component.fullName === reference.fullName
            );
            const responsePaths = result
              .getFileResponses()
              .flatMap(response => (response.filePath ? [response.filePath] : []));
            const stagedFiles = yield* listStagedFiles(stagingUri);
            const reportedUris = yield* Effect.forEach(
              [...new Set([...result.components.getComponentFilenamesByNameAndType(member), ...responsePaths])],
              path => fsService.toUri(path),
              { concurrency: 'unbounded' }
            );
            const fileUris = [...new Map([...reportedUris, ...stagedFiles].map(uri => [uri.toString(), uri])).values()];
            const logicalBasename = Utils.basename(orgMetadataDocumentUri(registryAccess, { orgId, ...reference }));
            const metadataType = registryAccess.getTypeByName(reference.xmlName);
            const leafName = reference.fullName.split(/[/.]/).at(-1) ?? reference.fullName;
            const sourceBasenames = new Set([
              logicalBasename,
              `${logicalBasename}-meta.xml`,
              `${leafName}.${metadataType.suffix}`,
              `${leafName}.${metadataType.suffix}-meta.xml`
            ]);
            const sourceContentUri = sourceComponent?.content
              ? yield* fsService.toUri(sourceComponent.content)
              : undefined;
            const primaryUri =
              fileUris.find(uri => sourceBasenames.has(Utils.basename(uri))) ??
              fileUris.find(uri => !uri.path.endsWith('-meta.xml')) ??
              sourceContentUri ??
              fileUris[0];
            yield* Effect.annotateCurrentSpan({
              discoveredFileCount: fileUris.length,
              responsePathCount: responsePaths.length,
              selectedPrimaryPath: primaryUri?.toString()
            });
            if (!primaryUri) {
              return yield* new OrgMetadataCatalogError({
                cause: new Error('Retrieve completed without a readable source file'),
                message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`,
                reference
              });
            }
            const filePaths = [
              ...new Set([
                ...(sourceComponent?.content ? [sourceComponent.content] : []),
                ...(sourceComponent?.xml ? [sourceComponent.xml] : []),
                ...(sourceComponent ? [...sourceComponent.walkContent()] : [])
              ])
            ];
            const sourceComponentUris = yield* Effect.forEach(filePaths, path => fsService.toUri(path), {
              concurrency: 'unbounded'
            });
            const artifactFileUris = [
              ...new Map([...fileUris, ...sourceComponentUris].map(uri => [uri.toString(), uri])).values()
            ];
            const fileProperties = Array.isArray(result.response.fileProperties)
              ? result.response.fileProperties
              : [result.response.fileProperties];
            const remoteLastModifiedDate = fileProperties.find(
              property => property?.type === reference.xmlName && property.fullName === reference.fullName
            )?.lastModifiedDate;
            return yield* shadowStore
              .publish({
                orgId,
                reference,
                stagingUri,
                primaryUri,
                fileUris: artifactFileUris,
                remoteLastModifiedDate: expectedRemoteLastModifiedDate ?? remoteLastModifiedDate
              })
              .pipe(
                Effect.flatMap(artifact =>
                  artifact
                    ? Effect.succeed(artifact)
                    : Effect.fail(
                        new OrgMetadataCatalogError({
                          cause: new Error('Published shadow artifact could not be resolved'),
                          message: `Failed to publish ${reference.xmlName} '${reference.fullName}'`,
                          reference
                        })
                      )
                )
              );
          })
        ),
        Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
      );
    });

    const materializeRetrievedComponents = Effect.fn('OrgMetadataCatalog.materializeRetrievedComponents')(function* (
      requests: readonly {
        readonly reference: OrgMetadataComponentReference;
        readonly expectedRemoteLastModifiedDate?: string;
      }[]
    ) {
      if (requests.length === 0) return [];
      if (requests.length === 1) {
        const request = requests[0];
        return [
          {
            reference: request.reference,
            artifact: yield* materializeRetrievedComponent(request.reference, request.expectedRemoteLastModifiedDate)
          }
        ];
      }

      const orgId = yield* getActiveOrgId();
      const stagingUri = yield* shadowStore.prepareBatch(orgId);
      const members = requests.map(({ reference }) => ({
        type: reference.xmlName,
        fullName: reference.fullName
      }));
      const componentSet = yield* metadataRetrieveService.buildComponentSet(members);
      const nonEmptyComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
      return yield* metadataRetrieveService.retrieveComponentSetToDirectory(nonEmptyComponentSet, stagingUri).pipe(
        Effect.flatMap(result =>
          Effect.gen(function* () {
            const sourceComponents = [...result.components.getSourceComponents()];
            const responses = result.getFileResponses();
            const stagedFiles = yield* listStagedFiles(stagingUri);
            const fileProperties = Array.isArray(result.response.fileProperties)
              ? result.response.fileProperties
              : [result.response.fileProperties];

            return yield* Effect.forEach(
              requests,
              request =>
                Effect.gen(function* () {
                  const { reference } = request;
                  const member = { type: reference.xmlName, fullName: reference.fullName };
                  const sourceComponent = sourceComponents.find(
                    component => component.type.name === reference.xmlName && component.fullName === reference.fullName
                  );
                  const responsePaths = responses.flatMap(response =>
                    response.type === reference.xmlName && response.fullName === reference.fullName && response.filePath
                      ? [response.filePath]
                      : []
                  );
                  const reportedUris = yield* Effect.forEach(
                    [...new Set([...result.components.getComponentFilenamesByNameAndType(member), ...responsePaths])],
                    path => fsService.toUri(path),
                    { concurrency: 'unbounded' }
                  );
                  const logicalBasename = Utils.basename(
                    orgMetadataDocumentUri(registryAccess, { orgId, ...reference })
                  );
                  const metadataType = registryAccess.getTypeByName(reference.xmlName);
                  const leafName = reference.fullName.split(/[/.]/).at(-1) ?? reference.fullName;
                  const sourceBasenames = new Set([
                    logicalBasename,
                    `${logicalBasename}-meta.xml`,
                    `${leafName}.${metadataType.suffix}`,
                    `${leafName}.${metadataType.suffix}-meta.xml`
                  ]);
                  const discoveredUris = stagedFiles.filter(uri => sourceBasenames.has(Utils.basename(uri)));
                  const sourcePaths = [
                    ...(sourceComponent?.content ? [sourceComponent.content] : []),
                    ...(sourceComponent?.xml ? [sourceComponent.xml] : []),
                    ...(sourceComponent ? [...sourceComponent.walkContent()] : [])
                  ];
                  const sourceComponentUris = yield* Effect.forEach(sourcePaths, path => fsService.toUri(path), {
                    concurrency: 'unbounded'
                  });
                  const fileUris = [
                    ...new Map(
                      [...reportedUris, ...discoveredUris, ...sourceComponentUris].map(uri => [uri.toString(), uri])
                    ).values()
                  ];
                  const primaryUri =
                    fileUris.find(uri => sourceBasenames.has(Utils.basename(uri))) ??
                    fileUris.find(uri => !uri.path.endsWith('-meta.xml')) ??
                    fileUris[0];
                  if (!primaryUri) {
                    return yield* new OrgMetadataCatalogError({
                      cause: new Error('Retrieve completed without a readable source file'),
                      message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`,
                      reference
                    });
                  }

                  const remoteLastModifiedDate =
                    request.expectedRemoteLastModifiedDate ??
                    fileProperties.find(
                      property => property?.type === reference.xmlName && property.fullName === reference.fullName
                    )?.lastModifiedDate;
                  const { stagingUri: componentStagingUri } = yield* shadowStore.prepare(
                    orgId,
                    reference,
                    remoteLastModifiedDate
                  );
                  const copiedUris = yield* Effect.forEach(
                    fileUris,
                    uri => {
                      const stagingPrefix = stagingUri.path.endsWith('/') ? stagingUri.path : `${stagingUri.path}/`;
                      const relative = uri.path.startsWith(stagingPrefix)
                        ? uri.path.slice(stagingPrefix.length)
                        : Utils.basename(uri);
                      const targetUri = Utils.joinPath(componentStagingUri, ...relative.split('/'));
                      return fsService.readFile(uri).pipe(
                        Effect.flatMap(content => fsService.safeWriteFile(targetUri, content)),
                        Effect.as([uri.toString(), targetUri] as const)
                      );
                    },
                    { concurrency: 10 }
                  );
                  const copiedBySource = new Map(copiedUris);
                  const copiedPrimaryUri = copiedBySource.get(primaryUri.toString());
                  if (!copiedPrimaryUri) {
                    return yield* Effect.die(new Error(`Failed to stage ${reference.xmlName} '${reference.fullName}'`));
                  }
                  const artifact = yield* shadowStore.publish({
                    orgId,
                    reference,
                    stagingUri: componentStagingUri,
                    primaryUri: copiedPrimaryUri,
                    fileUris: [...copiedBySource.values()],
                    remoteLastModifiedDate
                  });
                  if (!artifact) {
                    return yield* new OrgMetadataCatalogError({
                      cause: new Error('Published shadow artifact could not be resolved'),
                      message: `Failed to publish ${reference.xmlName} '${reference.fullName}'`,
                      reference
                    });
                  }
                  return { reference, artifact };
                }),
              { concurrency: 1 }
            );
          })
        ),
        Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
      );
    });

    const materializePrimaryDocument = Effect.fn('OrgMetadataCatalog.materializePrimaryDocument')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const orgId = yield* getActiveOrgId();
      const entry = yield* getEntry(reference);
      if (!entry?.inOrg) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`));
      }
      const cached = yield* shadowStore.get(orgId, reference, entry.lastModifiedDate);
      if (cached) return cached;
      if (reference.xmlName !== 'ApexClass') {
        return yield* materializeRetrievedComponent(reference, entry.lastModifiedDate);
      }

      const { content, lastModifiedDate } = yield* fetchApexClass(reference);
      const shadowRevision = entry.lastModifiedDate ?? lastModifiedDate;
      const { stagingUri } = yield* shadowStore.prepare(orgId, reference, shadowRevision);
      const primaryUri = Utils.joinPath(
        stagingUri,
        Utils.basename(orgMetadataDocumentUri(registryAccess, { orgId, ...reference }))
      );
      return yield* fsService.safeWriteFile(primaryUri, content).pipe(
        Effect.flatMap(() =>
          shadowStore.publish({
            orgId,
            reference,
            stagingUri,
            primaryUri,
            fileUris: [primaryUri],
            remoteLastModifiedDate: shadowRevision
          })
        ),
        Effect.flatMap(artifact =>
          artifact
            ? Effect.succeed(artifact)
            : Effect.fail(
                new OrgMetadataCatalogError({
                  cause: new Error('Published shadow artifact could not be resolved'),
                  message: `Failed to publish Apex class '${reference.fullName}'`,
                  reference
                })
              )
        ),
        Effect.ensuring(fsService.safeDelete(stagingUri, { recursive: true }))
      );
    });

    const materializeRemoteSources = Effect.fn('OrgMetadataCatalog.materializeRemoteSources')(function* (
      references: readonly OrgMetadataComponentReference[],
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      return yield* materializeSemaphore.withPermits(1)(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan('consistency', options.consistency ?? 'cache-first');
          const orgId = yield* getActiveOrgId();
          const forceRefresh = options.consistency === 'refresh';
          const uniqueReferences = [
            ...references
              .reduce(
                (unique, reference) => unique.set(`${reference.xmlName}\0${reference.fullName}`, reference),
                new Map<string, OrgMetadataComponentReference>()
              )
              .values()
          ];
          const loadedInventories = yield* Ref.get(inventoryCache);
          const resolved = yield* Effect.forEach(
            uniqueReferences,
            reference =>
              Effect.gen(function* () {
                const key = typeCacheKey(orgId, reference.xmlName);
                const loadedEntry = loadedInventories.get(key)?.components.get(reference.fullName);
                const entry = forceRefresh ? loadedEntry : yield* getEntry(reference);
                if (!forceRefresh && !entry?.inOrg) {
                  return yield* Effect.fail(
                    vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`)
                  );
                }
                const artifact = forceRefresh
                  ? undefined
                  : yield* shadowStore.get(orgId, reference, entry?.lastModifiedDate);
                return { reference, entry, artifact };
              }),
            { concurrency: 10 }
          );
          const retrievalRequests = resolved.flatMap(({ reference, entry, artifact }) =>
            artifact
              ? []
              : [
                  {
                    reference,
                    expectedRemoteLastModifiedDate: forceRefresh ? undefined : entry?.lastModifiedDate
                  }
                ]
          );
          const retrieved = yield* materializeRetrievedComponents(retrievalRequests);
          const artifactByIdentity = new Map<string, OrgMetadataShadowArtifact>([
            ...resolved.flatMap(({ reference, artifact }) =>
              artifact ? [[`${reference.xmlName}\0${reference.fullName}`, artifact] as const] : []
            ),
            ...retrieved.map(
              ({ reference, artifact }) => [`${reference.xmlName}\0${reference.fullName}`, artifact] as const
            )
          ]);
          yield* Effect.annotateCurrentSpan({
            requestedComponentCount: references.length,
            uniqueComponentCount: uniqueReferences.length,
            cacheHitCount: resolved.length - retrievalRequests.length,
            retrievedComponentCount: retrievalRequests.length
          });

          if (forceRefresh && retrieved.length > 0) {
            const observedAt = new Date().toISOString();
            yield* Ref.update(inventoryCache, current => {
              const next = new Map(current);
              retrieved.forEach(({ reference, artifact }) => {
                const key = typeCacheKey(orgId, reference.xmlName);
                const inventory = next.get(key);
                if (!inventory) return;
                const currentEntry = inventory.components.get(reference.fullName);
                const remoteLastModifiedDate = artifact.remoteLastModifiedDate;
                const updatedEntry: OrgMetadataCatalogEntry = {
                  ...currentEntry,
                  orgId,
                  observedAt,
                  provenance: currentEntry?.inWorkspace ? 'metadata-api+workspace' : 'metadata-api',
                  reference,
                  documentUri: entryUri(orgId, reference.xmlName, reference.fullName),
                  name: currentEntry?.name ?? reference.fullName.split('/').at(-1) ?? reference.fullName,
                  kind: 'component',
                  inOrg: true,
                  inWorkspace: currentEntry?.inWorkspace ?? false,
                  lastModifiedDate: remoteLastModifiedDate ?? currentEntry?.lastModifiedDate,
                  remoteLastModifiedDate: remoteLastModifiedDate ?? currentEntry?.remoteLastModifiedDate
                };
                next.set(key, {
                  ...inventory,
                  observedAt,
                  components: new Map(inventory.components).set(reference.fullName, updatedEntry)
                });
              });
              return next;
            });
            yield* persistOrg(orgId);
          }
          return yield* Effect.forEach(uniqueReferences, reference => {
            const artifact = artifactByIdentity.get(`${reference.xmlName}\0${reference.fullName}`);
            return artifact
              ? Effect.succeed({ reference, artifact })
              : Effect.die(
                  new Error(`No shadow artifact was produced for ${reference.xmlName} '${reference.fullName}'`)
                );
          });
        })
      );
    });

    const materializeRemoteSource = Effect.fn('OrgMetadataCatalog.materializeRemoteSource')(function* (
      reference: OrgMetadataComponentReference,
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      const [materialized] = yield* materializeRemoteSources([reference], options);
      return materialized
        ? materialized.artifact
        : yield* Effect.die(
            new Error(`No shadow artifact was produced for ${reference.xmlName} '${reference.fullName}'`)
          );
    });

    const getRemoteDocument = Effect.fn('OrgMetadataCatalog.getRemoteDocument')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const entry = yield* getEntry(reference);
      if (!entry?.inOrg) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`));
      }
      return {
        reference,
        uri: orgMetadataDocumentUri(registryAccess, { orgId: yield* getActiveOrgId(), ...reference }),
        remoteLastModifiedDate: entry.lastModifiedDate
      };
    });

    const hasChangeTracking = Effect.fn('OrgMetadataCatalog.hasChangeTracking')(function* () {
      return yield* sourceTrackingService.hasTracking();
    });

    const getChangeStatus = Effect.fn('OrgMetadataCatalog.getChangeStatus')(function* (
      options: { local: true; remote?: never } | { remote: true; local?: never } | { local: true; remote: true }
    ) {
      const orgId = yield* getActiveOrgId();
      const observedAt = new Date().toISOString();
      return (yield* sourceTrackingService.getStatus(options)).map(row => ({
        ...row,
        orgId,
        observedAt,
        provenance: 'source-tracking' as const
      }));
    });

    const read = Effect.fn('OrgMetadataCatalog.read')(function* (reference: OrgMetadataComponentReference) {
      const presence = yield* getPresence(reference);
      if (!presence.inOrg && !presence.inWorkspace) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(`${reference.xmlName}:${reference.fullName}`));
      }
      if (presence.workspaceUri) {
        return yield* Effect.tryPromise({
          try: () => vscode.workspace.fs.readFile(presence.workspaceUri!),
          catch: error => {
            const { cause } = unknownToErrorCause(error);
            return new OrgMetadataCatalogError({
              cause,
              message: `Failed to read workspace source for ${reference.xmlName} '${reference.fullName}'`,
              reference
            });
          }
        }).pipe(Effect.map(bytes => new TextDecoder().decode(bytes)));
      }
      const artifact = yield* materializeSemaphore.withPermits(1)(materializePrimaryDocument(reference));
      return yield* fsService.readFile(artifact.primaryUri);
    });

    const readDocumentUri = Effect.fn('OrgMetadataCatalog.readDocumentUri')(function* (uri: URI) {
      const location = parseOrgMetadataDocumentUri(registryAccess, uri);
      if (!location) return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      yield* assertActiveOrg(location.orgId);
      return yield* read(location);
    });

    const getDocumentReference = Effect.fn('OrgMetadataCatalog.getDocumentReference')(function* (uri: URI) {
      const location = parseOrgMetadataDocumentUri(registryAccess, uri);
      if (!location) return undefined;
      const activeOrgId = yield* getActiveOrgId();
      return location.orgId === activeOrgId ? { xmlName: location.xmlName, fullName: location.fullName } : undefined;
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
      yield* ensureHydrated(orgId);
      const activeTypeSemaphores = [...(yield* Ref.get(inventorySemaphores))]
        .filter(([key]) => key.startsWith(`${orgId}\0`))
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([, semaphore]) => semaphore);
      yield* withInventorySemaphores(
        activeTypeSemaphores,
        Effect.all(
          [
            Ref.update(
              inventoryCache,
              current => new Map([...current].filter(([key]) => !key.startsWith(`${orgId}\0`)))
            ),
            Ref.update(
              persistedInventoryCache,
              current => new Map([...current].filter(([key]) => !key.startsWith(`${orgId}\0`)))
            ),
            Ref.update(workspaceTypeCache, current => {
              const next = new Map(current);
              next.delete(orgId);
              return next;
            })
          ],
          { discard: true }
        )
      );
      yield* persistOrg(orgId);
    });

    const invalidateReferencesInternal = Effect.fn('OrgMetadataCatalog.invalidateReferencesInternal')(function* (
      references: readonly OrgMetadataComponentReference[],
      persist: boolean
    ) {
      const orgId = yield* getActiveOrgId();
      yield* ensureHydrated(orgId);
      const affectedTypes = new Set(references.map(reference => reference.xmlName));
      const affectedIdentities = new Set(references.map(reference => `${reference.xmlName}\0${reference.fullName}`));
      const affectedTypeSemaphores = yield* Effect.all(
        [...affectedTypes].toSorted().map(xmlName => getInventorySemaphore(typeCacheKey(orgId, xmlName)))
      );
      yield* withInventorySemaphores(
        affectedTypeSemaphores,
        Effect.all(
          [
            Ref.update(inventoryCache, current => {
              const next = new Map(current);
              affectedTypes.forEach(xmlName => next.delete(typeCacheKey(orgId, xmlName)));
              return next;
            }),
            Ref.update(persistedInventoryCache, current => {
              const next = new Map(current);
              affectedTypes.forEach(xmlName => next.delete(typeCacheKey(orgId, xmlName)));
              return next;
            })
          ],
          { discard: true }
        )
      );
      yield* Ref.update(remoteTrackingCache, cache => {
        const observations = cache.get(orgId);
        if (!observations) return cache;
        const remaining = new Map([...observations].filter(([identity]) => !affectedIdentities.has(identity)));
        return new Map(cache).set(orgId, remaining);
      });
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
        yield* Ref.update(sobjectListCache, current => {
          const next = new Map(current);
          next.delete(orgId);
          return next;
        });
        yield* Ref.update(sobjectDescriptionCache, current => {
          const next = new Map(current);
          affectedSObjects.forEach(apiName => next.delete(sobjectDescriptionKey(orgId, apiName)));
          return next;
        });
      }
      if (persist) yield* persistOrg(orgId);
    });

    const invalidateReferences = Effect.fn('OrgMetadataCatalog.invalidateReferences')(function* (
      references: readonly OrgMetadataComponentReference[]
    ) {
      yield* invalidateReferencesInternal(references, true);
    });

    const refreshChangeStatus = Effect.fn('OrgMetadataCatalog.refreshChangeStatus')(function* (
      options: { local: true; remote?: never } | { remote: true; local?: never } | { local: true; remote: true }
    ) {
      const orgId = yield* getActiveOrgId();
      yield* ensureHydrated(orgId);
      const observedAt = new Date().toISOString();
      const { remoteChanges, status } = yield* sourceTrackingService.getStatusWithRemoteChanges(options);
      if (options.remote) {
        const revisionByIdentity = new Map(
          remoteChanges.map(change => [
            `${change.type}\0${change.name}`,
            JSON.stringify([
              change.revisionCounter,
              change.lastModifiedDate,
              change.memberIdOrName,
              change.deleted,
              change.modified
            ])
          ])
        );
        const current = new Map<string, RemoteTrackingObservation>();
        status
          .filter(row => row.origin === 'remote')
          .forEach(row => {
            const key = `${row.type}\0${row.fullName}`;
            current.set(key, {
              reference: { xmlName: row.type, fullName: row.fullName },
              signature: `${row.state}\0${revisionByIdentity.get(key) ?? ''}`
            });
          });
        const previousByOrg = yield* Ref.get(remoteTrackingCache);
        const previous = previousByOrg.get(orgId) ?? new Map<string, RemoteTrackingObservation>();
        const changedReferences = [
          ...[...new Set([...previous.keys(), ...current.keys()])]
            .filter(key => previous.get(key)?.signature !== current.get(key)?.signature)
            .flatMap(key => {
              const observation = current.get(key) ?? previous.get(key);
              return observation ? [observation.reference] : [];
            })
            .reduce(
              (references, reference) => references.set(`${reference.xmlName}\0${reference.fullName}`, reference),
              new Map<string, OrgMetadataComponentReference>()
            )
            .values()
        ];
        yield* Effect.annotateCurrentSpan({
          changedRemoteComponentCount: changedReferences.length,
          remoteStatusRows: current.size
        });
        if (changedReferences.length > 0) {
          yield* invalidateReferencesInternal(changedReferences, false);
          yield* Ref.update(remoteTrackingCache, cache => new Map(cache).set(orgId, current));
          yield* persistOrg(orgId);
          yield* PubSub.publish(catalogChanges, {
            kind: 'tracking',
            orgId,
            references: changedReferences
          });
        }
      }
      return status.map(row => ({
        ...row,
        orgId,
        observedAt,
        provenance: 'source-tracking' as const
      }));
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
      yield* ensureHydrated(orgId);
      yield* Effect.all(
        [
          metadataDescribeService.invalidateListSObjects(),
          metadataDescribeService.invalidateSObjectDescribes(apiNames)
        ],
        { discard: true }
      );
      yield* Ref.update(sobjectListCache, current => {
        const next = new Map(current);
        next.delete(orgId);
        return next;
      });
      yield* Ref.update(sobjectDescriptionCache, current => {
        const next = new Map(current);
        if (apiNames) {
          apiNames.forEach(apiName => next.delete(sobjectDescriptionKey(orgId, apiName)));
        } else {
          [...next.keys()].filter(key => key.startsWith(`${orgId}\0`)).forEach(key => next.delete(key));
        }
        return next;
      });
      yield* persistOrg(orgId);
      return yield* listSObjects();
    });

    const refreshSObject = Effect.fn('OrgMetadataCatalog.refreshSObject')(function* (apiName: string) {
      yield* ensureHydrated(yield* getActiveOrgId());
      return yield* reacquireSObjectDescription(apiName);
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
