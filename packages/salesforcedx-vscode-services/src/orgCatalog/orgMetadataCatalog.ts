/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../core/componentSetService';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { unknownToErrorCause } from '../core/shared';
import { FsService } from '../vscode/fsService';
import { WorkspaceService } from '../vscode/workspaceService';
import {
  isOrgMetadataComponentReference,
  type OrgMetadataComponentReference,
  type OrgMetadataReference,
  orgMetadataDocumentUri,
  parseOrgMetadataDocumentUri
} from './orgMetadataReference';

const FOLDERED_METADATA_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);

export type OrgMetadataPresence = {
  readonly inOrg: boolean;
  readonly inWorkspace: boolean;
  readonly workspaceUri?: URI;
};

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
  readonly reference: OrgMetadataReference;
  readonly name: string;
  readonly kind: OrgMetadataEntryKind;
  readonly documentUri: URI;
  readonly namespacePrefix?: string;
  readonly manageableState?: string;
  readonly field?: OrgMetadataFieldDetails;
};

type ListedMetadataComponent = {
  readonly fullName: string;
  readonly namespacePrefix?: string;
  readonly manageableState?: string;
};

type TypeInventory = {
  readonly components: ReadonlyMap<string, OrgMetadataCatalogEntry>;
  readonly folders: ReadonlyMap<string, ListedMetadataComponent>;
};

type InventoryCache = ReadonlyMap<string, TypeInventory>;

export class OrgMetadataCatalogError extends Data.TaggedError('OrgMetadataCatalogError')<{
  readonly cause: Error;
  readonly message: string;
  readonly reference?: OrgMetadataReference;
}> {}

const emptyPresence = (): OrgMetadataPresence => ({ inOrg: false, inWorkspace: false });
const typeCacheKey = (orgId: string, xmlName: string): string => `${orgId}\0${xmlName}`;
const componentCacheKey = (orgId: string, reference: OrgMetadataComponentReference): string =>
  `${orgId}\0${reference.xmlName}\0${reference.fullName}`;
const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const entryUri = (orgId: string, xmlName: string, fullName: string): URI =>
  orgMetadataDocumentUri({ orgId, xmlName, fullName: fullName || '__type__' });

const mergeInventory = ({
  orgId,
  xmlName,
  orgComponents,
  workspaceUris
}: {
  readonly orgId: string;
  readonly xmlName: string;
  readonly orgComponents: readonly ListedMetadataComponent[];
  readonly workspaceUris: ReadonlyMap<string, URI>;
}): ReadonlyMap<string, OrgMetadataCatalogEntry> => {
  const orgInventory = orgComponents.reduce(
    (entries, component) =>
      entries.set(component.fullName, {
        reference: { xmlName, fullName: component.fullName },
        documentUri: entryUri(orgId, xmlName, component.fullName),
        name: component.fullName.split('/').at(-1) ?? component.fullName,
        kind: 'component',
        namespacePrefix: component.namespacePrefix,
        manageableState: component.manageableState,
        inOrg: true,
        inWorkspace: false
      }),
    new Map<string, OrgMetadataCatalogEntry>()
  );
  return [...workspaceUris].reduce((entries, [fullName, workspaceUri]) => {
    const existing = entries.get(fullName);
    return entries.set(fullName, {
      reference: { xmlName, fullName },
      documentUri: existing?.documentUri ?? entryUri(orgId, xmlName, fullName),
      name: existing?.name ?? fullName.split('/').at(-1) ?? fullName,
      kind: 'component',
      namespacePrefix: existing?.namespacePrefix,
      manageableState: existing?.manageableState,
      inOrg: existing?.inOrg ?? false,
      inWorkspace: true,
      workspaceUri
    });
  }, orgInventory);
};

const projectChildren = (
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
        reference: { xmlName, fullName },
        documentUri: entryUri(orgId, xmlName, fullName),
        name,
        kind: 'folder' as const,
        namespacePrefix: folder?.namespacePrefix,
        manageableState: folder?.manageableState,
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
    MetadataRetrieveService.Default,
    ProjectService.Default,
    WorkspaceService.Default
  ],
  effect: Effect.gen(function* () {
    const [
      componentSetService,
      connectionService,
      fsService,
      metadataDescribeService,
      metadataRetrieveService,
      projectService,
      workspaceService
    ] = yield* Effect.all([
      ComponentSetService,
      ConnectionService,
      FsService,
      MetadataDescribeService,
      MetadataRetrieveService,
      ProjectService,
      WorkspaceService
    ]);
    const inventoryCache = yield* Ref.make<InventoryCache>(new Map());
    const contentCache = yield* Ref.make<ReadonlyMap<string, string>>(new Map());
    const workspaceTypeCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

    const getActiveOrgId = Effect.fn('OrgMetadataCatalog.getActiveOrgId')(function* () {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      if (!orgId) {
        return yield* Effect.fail(vscode.FileSystemError.Unavailable('No default org is configured'));
      }
      return orgId;
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
        if (component.type.name !== xmlName || !component.content) return workspaceUris;
        const candidate = URI.file(component.content);
        const existing = workspaceUris.get(component.fullName);
        if (!existing || candidate.path.length < existing.path.length) {
          workspaceUris.set(component.fullName, candidate);
        }
        return workspaceUris;
      }, new Map<string, URI>());
    });

    const loadType = Effect.fn('OrgMetadataCatalog.loadType')(function* (xmlName: string) {
      const orgId = yield* getActiveOrgId();
      const key = typeCacheKey(orgId, xmlName);
      const cached = (yield* Ref.get(inventoryCache)).get(key);
      if (cached) return cached;
      const listOrgComponents = FOLDERED_METADATA_TYPES.has(xmlName)
        ? Effect.gen(function* () {
            const folders = yield* metadataDescribeService.listMetadata(`${xmlName}Folder`);
            const folderComponents = yield* Effect.all(
              folders.map(folder => metadataDescribeService.listMetadata(xmlName, folder.fullName)),
              { concurrency: 10 }
            );
            return { components: folderComponents.flat(), folders };
          })
        : metadataDescribeService.listMetadata(xmlName).pipe(Effect.map(components => ({ components, folders: [] })));
      const [orgListing, workspaceUris] = yield* Effect.all(
        [listOrgComponents, scanWorkspace(xmlName).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, URI>())))],
        { concurrency: 'unbounded' }
      );
      const inventory = {
        components: mergeInventory({
          orgId,
          xmlName,
          orgComponents: orgListing.components,
          workspaceUris
        }),
        folders: new Map(orgListing.folders.map(folder => [folder.fullName, folder]))
      };
      yield* Ref.update(inventoryCache, current => new Map(current).set(key, inventory));
      return inventory;
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

    const getCustomFieldChildren = Effect.fn('OrgMetadataCatalog.getCustomFieldChildren')(function* (
      objectEntry: OrgMetadataCatalogEntry
    ) {
      if (!isOrgMetadataComponentReference(objectEntry.reference)) return [];
      const orgId = yield* getActiveOrgId();
      const objectApiName = objectEntry.namespacePrefix
        ? `${objectEntry.namespacePrefix}__${objectEntry.reference.fullName}`
        : objectEntry.reference.fullName;
      const describedObject = yield* metadataDescribeService.describeCustomObject(objectApiName);
      const fieldInventory = yield* loadType('CustomField');
      return describedObject.fields
        .filter(field => field.custom)
        .map(field => {
          const unqualifiedName = objectEntry.namespacePrefix
            ? field.name.replace(`${objectEntry.namespacePrefix}__`, '')
            : field.name;
          const candidates = [
            `${objectEntry.reference.fullName}.${field.name}`,
            `${objectEntry.reference.fullName}.${unqualifiedName}`
          ];
          const fullName = candidates.find(candidate => fieldInventory.components.has(candidate)) ?? candidates[0];
          const existing = fieldInventory.components.get(fullName);
          return {
            ...(existing ?? {
              reference: { xmlName: 'CustomField', fullName },
              documentUri: entryUri(orgId, 'CustomField', fullName),
              kind: 'component' as const,
              inOrg: true,
              inWorkspace: false
            }),
            name: unqualifiedName,
            namespacePrefix: objectEntry.namespacePrefix,
            field: {
              name: unqualifiedName,
              type: field.type,
              length: field.length,
              relationshipName: field.relationshipName,
              scale: field.scale,
              precision: field.precision
            }
          } satisfies OrgMetadataCatalogEntry;
        })
        .toSorted((left, right) => left.name.localeCompare(right.name));
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
      const children = projectChildren(orgId, reference.xmlName, reference.fullName, inventory);
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
      return inventory ? projectChildren(orgId, reference.xmlName, reference.fullName, inventory) : undefined;
    });

    const getEntry = Effect.fn('OrgMetadataCatalog.getEntry')(function* (reference: OrgMetadataComponentReference) {
      const orgId = yield* getActiveOrgId();
      const inventory = yield* loadType(reference.xmlName);
      return (
        inventory.components.get(reference.fullName) ??
        projectChildren(
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
        orgMetadataDocumentUri({
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
      const query = `SELECT Body FROM ApexClass WHERE Name = '${escapeSoql(className)}'${namespaceFilter} LIMIT 1`;
      const result = yield* Effect.tryPromise({
        try: () => connection.tooling.query<{ Body?: string }>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new OrgMetadataCatalogError({
            cause,
            message: `Failed to retrieve Apex class '${reference.fullName}': ${cause.message}`,
            reference
          });
        }
      });
      const body = result.records[0]?.Body;
      if (body?.includes('(hidden)')) return `// Source code for managed class '${reference.fullName}' is protected.`;
      if (body) return body;
      return yield* new OrgMetadataCatalogError({
        cause: new Error('Apex class body was not returned'),
        message: `Apex class '${reference.fullName}' has no readable source body`,
        reference
      });
    });

    const fetchGenericComponent = Effect.fn('OrgMetadataCatalog.fetchGenericComponent')(function* (
      reference: OrgMetadataComponentReference
    ) {
      const orgId = yield* getActiveOrgId();
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      const outputUri = Utils.joinPath(
        workspace.uri,
        '.sf',
        'org-catalog-read',
        orgId,
        encodeURIComponent(reference.xmlName),
        ...reference.fullName.split('/').map(encodeURIComponent)
      );
      const member = { type: reference.xmlName, fullName: reference.fullName };
      const componentSet = yield* metadataRetrieveService.buildComponentSet([member]);
      const nonEmptyComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
      yield* fsService.safeDelete(outputUri, { recursive: true });
      return yield* metadataRetrieveService.retrieveComponentSetToDirectory(nonEmptyComponentSet, outputUri).pipe(
        Effect.flatMap(result => {
          const sourceComponent = [...result.components.getSourceComponents()].find(
            component => component.type.name === reference.xmlName && component.fullName === reference.fullName
          );
          const candidatePath =
            sourceComponent?.content ??
            result.components.getComponentFilenamesByNameAndType(member).find(path => !path.endsWith('-meta.xml'));
          if (!candidatePath) {
            return Effect.fail(
              new OrgMetadataCatalogError({
                cause: new Error('Retrieve completed without a readable source file'),
                message: `Retrieved ${reference.xmlName} '${reference.fullName}', but no source file was produced`,
                reference
              })
            );
          }
          return Effect.tryPromise({
            try: () => vscode.workspace.fs.readFile(URI.file(candidatePath)),
            catch: error => {
              const { cause } = unknownToErrorCause(error);
              return new OrgMetadataCatalogError({
                cause,
                message: `Failed to read retrieved ${reference.xmlName} '${reference.fullName}': ${cause.message}`,
                reference
              });
            }
          }).pipe(Effect.map(bytes => new TextDecoder().decode(bytes)));
        }),
        Effect.ensuring(fsService.safeDelete(outputUri, { recursive: true }))
      );
    });

    const read = Effect.fn('OrgMetadataCatalog.read')(function* (reference: OrgMetadataComponentReference) {
      const orgId = yield* getActiveOrgId();
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
      const key = componentCacheKey(orgId, reference);
      const cached = (yield* Ref.get(contentCache)).get(key);
      if (cached !== undefined) return cached;
      const content =
        reference.xmlName === 'ApexClass' ? yield* fetchApexClass(reference) : yield* fetchGenericComponent(reference);
      yield* Ref.update(contentCache, current => new Map(current).set(key, content));
      return content;
    });

    const readDocumentUri = Effect.fn('OrgMetadataCatalog.readDocumentUri')(function* (uri: URI) {
      const location = parseOrgMetadataDocumentUri(uri);
      if (!location) return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      yield* assertActiveOrg(location.orgId);
      return yield* read(location);
    });

    const getDocumentReference = Effect.fn('OrgMetadataCatalog.getDocumentReference')(function* (uri: URI) {
      const location = parseOrgMetadataDocumentUri(uri);
      if (!location) return undefined;
      const activeOrgId = yield* getActiveOrgId();
      return location.orgId === activeOrgId ? { xmlName: location.xmlName, fullName: location.fullName } : undefined;
    });

    const download = Effect.fn('OrgMetadataCatalog.download')(function* (reference: OrgMetadataComponentReference) {
      yield* metadataRetrieveService.retrieve([{ type: reference.xmlName, fullName: reference.fullName }], {
        ignoreConflicts: true
      });
      yield* Effect.all(
        [Ref.set(inventoryCache, new Map()), Ref.set(contentCache, new Map()), Ref.set(workspaceTypeCache, new Map())],
        { discard: true }
      );
      return yield* getDocumentUri(reference);
    });

    const invalidate = Effect.fn('OrgMetadataCatalog.invalidate')(function* () {
      yield* Effect.all(
        [Ref.set(inventoryCache, new Map()), Ref.set(contentCache, new Map()), Ref.set(workspaceTypeCache, new Map())],
        { discard: true }
      );
    });

    const refresh = Effect.fn('OrgMetadataCatalog.refresh')(function* (reference: OrgMetadataReference = {}) {
      if (!reference.xmlName) {
        yield* metadataDescribeService.invalidateDescribe();
      } else {
        yield* metadataDescribeService.invalidateListMetadata(reference.xmlName);
      }
      yield* invalidate();
    });

    return {
      download,
      getChildren,
      getChildrenCached,
      getDocumentReference,
      getDocumentUri,
      getEntry,
      getPresence,
      getWorkspaceMetadataTypes,
      invalidate,
      read,
      readDocumentUri,
      refresh
    };
  })
}) {}
