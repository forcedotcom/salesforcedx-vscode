/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { orgDataUri, orgRoot } from './orgDataUris';
import { getOrgMetadataLocation, orgMetadataUri } from './orgMetadataUris';

const ORG_METADATA_OWNER = 'org-metadata';
const FOLDERED_METADATA_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);

export type PresenceState = {
  readonly inOrg: boolean;
  readonly inWorkspace: boolean;
  readonly workspaceUri?: URI;
};

type TypePresence = ReadonlyMap<string, PresenceState>;

export type OrgMetadataEntryKind = 'type' | 'folder' | 'component';

export type OrgMetadataFieldDetails = {
  readonly name: string;
  readonly type: string;
  readonly length?: number;
  readonly relationshipName?: string | null;
  readonly scale?: number;
  readonly precision?: number;
};

export type OrgMetadataInventoryEntry = PresenceState & {
  readonly uri: URI;
  readonly name: string;
  readonly xmlName: string;
  readonly fullName?: string;
  readonly kind: OrgMetadataEntryKind;
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
  readonly components: ReadonlyMap<string, OrgMetadataInventoryEntry>;
  readonly folders: ReadonlyMap<string, ListedMetadataComponent>;
};

type InventoryCache = ReadonlyMap<string, TypeInventory>;

const emptyPresence = (): PresenceState => ({ inOrg: false, inWorkspace: false });
const typeCacheKey = (orgKey: string, xmlName: string): string => `${orgKey}\0${xmlName}`;

export const mergePresence = ({
  orgNames,
  workspaceUris
}: {
  readonly orgNames: Iterable<string>;
  readonly workspaceUris: ReadonlyMap<string, URI>;
}): TypePresence => {
  const orgPresence = [...orgNames].reduce(
    (entries, fullName) => entries.set(fullName, { inOrg: true, inWorkspace: false }),
    new Map<string, PresenceState>()
  );
  return [...workspaceUris].reduce(
    (entries, [fullName, workspaceUri]) =>
      entries.set(fullName, {
        inOrg: entries.get(fullName)?.inOrg ?? false,
        inWorkspace: true,
        workspaceUri
      }),
    orgPresence
  );
};

const mergeInventory = ({
  orgKey,
  xmlName,
  orgComponents,
  workspaceUris
}: {
  readonly orgKey: string;
  readonly xmlName: string;
  readonly orgComponents: readonly ListedMetadataComponent[];
  readonly workspaceUris: ReadonlyMap<string, URI>;
}): ReadonlyMap<string, OrgMetadataInventoryEntry> => {
  const orgInventory = orgComponents.reduce(
    (entries, component) =>
      entries.set(component.fullName, {
        uri: orgMetadataUri({ orgKey, xmlName, fullName: component.fullName }),
        name: component.fullName.split('/').at(-1) ?? component.fullName,
        xmlName,
        fullName: component.fullName,
        kind: 'component',
        namespacePrefix: component.namespacePrefix,
        manageableState: component.manageableState,
        inOrg: true,
        inWorkspace: false
      }),
    new Map<string, OrgMetadataInventoryEntry>()
  );
  return [...workspaceUris].reduce((entries, [fullName, workspaceUri]) => {
    const existing = entries.get(fullName);
    return entries.set(fullName, {
      uri: existing?.uri ?? orgMetadataUri({ orgKey, xmlName, fullName }),
      name: existing?.name ?? fullName.split('/').at(-1) ?? fullName,
      xmlName,
      fullName,
      kind: 'component',
      namespacePrefix: existing?.namespacePrefix,
      manageableState: existing?.manageableState,
      inOrg: existing?.inOrg ?? false,
      inWorkspace: true,
      workspaceUri
    });
  }, orgInventory);
};

const projectTypeChildren = (
  orgKey: string,
  xmlName: string,
  componentSegments: readonly string[],
  inventory: TypeInventory
): OrgMetadataInventoryEntry[] => {
  const prefix = componentSegments.length > 0 ? `${componentSegments.join('/')}/` : '';
  const childNames = new Set<string>();
  [...inventory.components.keys(), ...inventory.folders.keys()].forEach(fullName => {
    if (!fullName.startsWith(prefix)) return;
    const remainder = fullName.slice(prefix.length);
    const name = remainder.split('/')[0];
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
      if (!folder && !hasDescendants && component) {
        return { ...component, name };
      }
      const descendantComponents = [...inventory.components.values()].filter(entry =>
        entry.fullName?.startsWith(`${fullName}/`)
      );
      return {
        uri: orgMetadataUri({ orgKey, xmlName, fullName }),
        name,
        xmlName,
        fullName,
        kind: 'folder' as const,
        namespacePrefix: folder?.namespacePrefix,
        manageableState: folder?.manageableState,
        inOrg: folder !== undefined || descendantComponents.some(entry => entry.inOrg),
        inWorkspace: descendantComponents.some(entry => entry.inWorkspace)
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));
};

export class OrgMetadataCatalog extends Effect.Service<OrgMetadataCatalog>()('OrgMetadataCatalog', {
  accessors: true,
  dependencies: [MetadataDescribeService.Default, MetadataRetrieveService.Default, ProjectService.Default],
  effect: Effect.gen(function* () {
    const [metadataDescribeService, metadataRetrieveService, projectService] = yield* Effect.all([
      MetadataDescribeService,
      MetadataRetrieveService,
      ProjectService
    ]);
    const cache = yield* Ref.make<InventoryCache>(new Map());
    const workspaceTypeCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

    const assertCurrentOrg = Effect.fn('OrgMetadataCatalog.assertCurrentOrg')(function* (orgKey: string) {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const activeOrgKey = orgId ? orgRoot(orgId).path.split('/').at(-1) : undefined;
      if (!activeOrgKey || activeOrgKey !== orgKey) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(orgRoot(orgKey)));
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

    const loadType = Effect.fn('OrgMetadataCatalog.loadType')(function* (orgKey: string, xmlName: string) {
      yield* assertCurrentOrg(orgKey);
      const key = typeCacheKey(orgKey, xmlName);
      const cached = (yield* Ref.get(cache)).get(key);
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
          orgKey,
          xmlName,
          orgComponents: orgListing.components,
          workspaceUris
        }),
        folders: new Map(orgListing.folders.map(folder => [folder.fullName, folder]))
      };
      yield* Ref.update(cache, current => new Map(current).set(key, inventory));
      return inventory;
    });

    const getPresence = Effect.fn('OrgMetadataCatalog.getPresence')(function* (canonicalUri: URI) {
      const location = getOrgMetadataLocation(canonicalUri);
      if (!location?.xmlName || location.componentSegments.length === 0) {
        return emptyPresence();
      }
      const inventory = yield* loadType(location.orgKey, location.xmlName);
      const entry = inventory.components.get(location.componentSegments.join('/'));
      return entry
        ? {
            inOrg: entry.inOrg,
            inWorkspace: entry.inWorkspace,
            ...(entry.workspaceUri ? { workspaceUri: entry.workspaceUri } : {})
          }
        : emptyPresence();
    });

    const isInWorkspace = Effect.fn('OrgMetadataCatalog.isInWorkspace')(function* (canonicalUri: URI) {
      return (yield* getPresence(canonicalUri)).inWorkspace;
    });

    const hasWorkspaceComponents = Effect.fn('OrgMetadataCatalog.hasWorkspaceComponents')(function* (
      canonicalTypeUri: URI
    ) {
      const location = getOrgMetadataLocation(canonicalTypeUri);
      if (!location?.xmlName || location.componentSegments.length > 0) return false;
      const inventory = yield* loadType(location.orgKey, location.xmlName);
      return [...inventory.components.values()].some(state => state.inWorkspace);
    });

    const getWorkspaceMetadataTypes = Effect.fn('OrgMetadataCatalog.getWorkspaceMetadataTypes')(function* (
      canonicalRootUri: URI
    ) {
      const location = getOrgMetadataLocation(canonicalRootUri);
      if (!location || location.xmlName) return new Set<string>();
      yield* assertCurrentOrg(location.orgKey);
      const cached = (yield* Ref.get(workspaceTypeCache)).get(location.orgKey);
      if (cached) return cached;
      const types = yield* Effect.gen(function* () {
        const project = yield* projectService.getSfProject();
        const packageDirectories = project.getPackageDirectories().map(directory => directory.fullPath);
        const componentSet = yield* metadataRetrieveService.buildComponentSetFromSource(packageDirectories, []);
        return new Set([...componentSet.getSourceComponents()].map(component => component.type.name));
      }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())));
      yield* Ref.update(workspaceTypeCache, current => new Map(current).set(location.orgKey, types));
      return types;
    });

    const getCustomFieldChildren = Effect.fn('OrgMetadataCatalog.getCustomFieldChildren')(function* (
      orgKey: string,
      objectEntry: OrgMetadataInventoryEntry
    ) {
      if (!objectEntry.fullName) {
        const emptyEntries: OrgMetadataInventoryEntry[] = [];
        return emptyEntries;
      }
      const objectApiName = objectEntry.namespacePrefix
        ? `${objectEntry.namespacePrefix}__${objectEntry.fullName}`
        : objectEntry.fullName;
      const describedObject = yield* metadataDescribeService.describeCustomObject(objectApiName);
      const fieldInventory = yield* loadType(orgKey, 'CustomField');
      const namespacePrefix = objectEntry.namespacePrefix;
      const entries: OrgMetadataInventoryEntry[] = describedObject.fields
        .filter(field => field.custom)
        .map(field => {
          const unqualifiedName = namespacePrefix ? field.name.replace(`${namespacePrefix}__`, '') : field.name;
          const candidates = [`${objectEntry.fullName}.${field.name}`, `${objectEntry.fullName}.${unqualifiedName}`];
          const fullName = candidates.find(candidate => fieldInventory.components.has(candidate)) ?? candidates[0];
          const existing = fieldInventory.components.get(fullName);
          return {
            ...(existing ?? {
              uri: orgMetadataUri({ orgKey, xmlName: 'CustomField', fullName }),
              xmlName: 'CustomField',
              fullName,
              kind: 'component' as const,
              inOrg: true,
              inWorkspace: false
            }),
            name: unqualifiedName,
            namespacePrefix,
            field: {
              name: unqualifiedName,
              type: field.type,
              length: field.length,
              relationshipName: field.relationshipName,
              scale: field.scale,
              precision: field.precision
            }
          } satisfies OrgMetadataInventoryEntry;
        })
        .toSorted((left, right) => left.name.localeCompare(right.name));
      return entries;
    });

    const getChildren = Effect.fn('OrgMetadataCatalog.getChildren')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(uri));
      }
      yield* assertCurrentOrg(location.orgKey);
      if (!location.xmlName) {
        const [metadataTypes, workspaceTypes] = yield* Effect.all(
          [metadataDescribeService.describe(), getWorkspaceMetadataTypes(uri)],
          { concurrency: 'unbounded' }
        );
        const orgTypes = new Set(metadataTypes.map(type => type.xmlName));
        const entries: OrgMetadataInventoryEntry[] = [...new Set([...orgTypes, ...workspaceTypes])]
          .map(xmlName => ({
            uri: orgMetadataUri({ orgKey: location.orgKey, xmlName, fullName: '' }),
            name: xmlName,
            xmlName,
            kind: 'type' as const,
            inOrg: orgTypes.has(xmlName),
            inWorkspace: workspaceTypes.has(xmlName)
          }))
          .toSorted((left, right) => left.name.localeCompare(right.name));
        return entries;
      }

      const inventory = yield* loadType(location.orgKey, location.xmlName);
      const fullName = location.componentSegments.join('/');
      const component = inventory.components.get(fullName);
      if (component && location.xmlName === 'CustomObject') {
        return yield* getCustomFieldChildren(location.orgKey, component);
      }
      const children = projectTypeChildren(location.orgKey, location.xmlName, location.componentSegments, inventory);
      if (children.length === 0 && location.componentSegments.length > 0) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(uri));
      }
      return children;
    });

    const getChildrenCached = Effect.fn('OrgMetadataCatalog.getChildrenCached')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location?.xmlName) return undefined;
      const inventory = (yield* Ref.get(cache)).get(typeCacheKey(location.orgKey, location.xmlName));
      return inventory
        ? projectTypeChildren(location.orgKey, location.xmlName, location.componentSegments, inventory)
        : undefined;
    });

    const getEntry = Effect.fn('OrgMetadataCatalog.getEntry')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location?.xmlName) return undefined;
      if (location.componentSegments.length === 0) {
        const rootUri = orgDataUri({ orgKey: location.orgKey, owner: ORG_METADATA_OWNER, segments: [] });
        return (yield* getChildren(rootUri)).find(entry => entry.xmlName === location.xmlName);
      }
      const inventory = yield* loadType(location.orgKey, location.xmlName);
      const fullName = location.componentSegments.join('/');
      return (
        inventory.components.get(fullName) ??
        projectTypeChildren(location.orgKey, location.xmlName, location.componentSegments.slice(0, -1), inventory).find(
          entry => entry.fullName === fullName
        )
      );
    });

    const invalidate = Effect.fn('OrgMetadataCatalog.invalidate')(function* () {
      yield* Effect.all([Ref.set(cache, new Map()), Ref.set(workspaceTypeCache, new Map())], { discard: true });
    });

    const refresh = Effect.fn('OrgMetadataCatalog.refresh')(function* (uri?: URI) {
      const location = uri ? getOrgMetadataLocation(uri) : undefined;
      if (uri && !location) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      if (!location?.xmlName) {
        yield* metadataDescribeService.invalidateDescribe();
      } else {
        const fullName = location.componentSegments.join('/');
        const cached = (yield* Ref.get(cache)).get(typeCacheKey(location.orgKey, location.xmlName));
        if (FOLDERED_METADATA_TYPES.has(location.xmlName)) {
          const invalidations =
            location.componentSegments.length === 0
              ? [
                  metadataDescribeService.invalidateListMetadata(`${location.xmlName}Folder`),
                  ...(cached
                    ? [...cached.folders.keys()].map(folder =>
                        metadataDescribeService.invalidateListMetadata(location.xmlName!, folder)
                      )
                    : [])
                ]
              : [metadataDescribeService.invalidateListMetadata(location.xmlName, fullName)];
          yield* Effect.all(invalidations, { concurrency: 'unbounded', discard: true });
        } else {
          yield* metadataDescribeService.invalidateListMetadata(location.xmlName);
        }
        if (location.xmlName === 'CustomObject' && fullName) {
          const namespacePrefix = cached?.components.get(fullName)?.namespacePrefix;
          yield* Effect.all(
            [
              metadataDescribeService.invalidateSObjectDescribe(
                namespacePrefix ? `${namespacePrefix}__${fullName}` : fullName
              ),
              metadataDescribeService.invalidateListMetadata('CustomField')
            ],
            { concurrency: 'unbounded', discard: true }
          );
        }
      }
      yield* invalidate();
    });

    return {
      getChildren,
      getChildrenCached,
      getEntry,
      getPresence,
      getWorkspaceMetadataTypes,
      hasWorkspaceComponents,
      invalidate,
      isInWorkspace,
      refresh
    };
  })
}) {}
