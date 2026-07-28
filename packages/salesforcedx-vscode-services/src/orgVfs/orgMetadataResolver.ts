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
import { orgDataSegments, orgDataUri, orgRoot } from './orgDataUris';

const ORG_METADATA_OWNER = 'org-metadata';
const FOLDERED_METADATA_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);

export type PresenceState = {
  readonly inOrg: boolean;
  readonly inWorkspace: boolean;
  readonly workspaceUri?: URI;
  readonly ephemeralContent?: Uint8Array;
};

type TypePresence = ReadonlyMap<string, PresenceState>;
type PresenceCache = ReadonlyMap<string, TypePresence>;

export class OrgMetadataResolutionError extends Data.TaggedError('OrgMetadataResolutionError')<{
  readonly cause: Error;
  readonly message: string;
  readonly uri: string;
}> {}

const emptyPresence = (): PresenceState => ({ inOrg: false, inWorkspace: false });
const typeCacheKey = (orgKey: string, xmlName: string): string => `${orgKey}\0${xmlName}`;
const decodeSegment = (segment: string): string => decodeURIComponent(segment);
const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const getOrgMetadataLocation = (
  uri: URI
):
  | { readonly orgKey: string; readonly xmlName?: string; readonly componentSegments: readonly string[] }
  | undefined => {
  const segments = orgDataSegments(uri, ORG_METADATA_OWNER);
  if (!segments) return undefined;
  const [, , orgKey] = uri.path.split('/');
  return {
    orgKey,
    xmlName: segments[0] ? decodeSegment(segments[0]) : undefined,
    componentSegments: segments.slice(1).map(decodeSegment)
  };
};

export const orgMetadataUri = ({
  orgKey,
  xmlName,
  fullName
}: {
  readonly orgKey: string;
  readonly xmlName: string;
  readonly fullName: string;
}): URI =>
  orgDataUri({
    orgKey,
    owner: ORG_METADATA_OWNER,
    segments: [xmlName, ...fullName.split('/')]
  });

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

const toFileStat = (type: vscode.FileType): vscode.FileStat => ({
  type,
  ctime: 0,
  mtime: 0,
  size: 0
});

export class OrgMetadataResolver extends Effect.Service<OrgMetadataResolver>()('OrgMetadataResolver', {
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
    const cache = yield* Ref.make<PresenceCache>(new Map());
    const folderCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
    const workspaceTypeCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

    const assertCurrentOrg = Effect.fn('OrgMetadataResolver.assertCurrentOrg')(function* (orgKey: string) {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      const activeOrgKey = orgId ? orgRoot(orgId).path.split('/').at(-1) : undefined;
      if (!activeOrgKey || activeOrgKey !== orgKey) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(orgRoot(orgKey)));
      }
    });

    const scanWorkspace = Effect.fn('OrgMetadataResolver.scanWorkspace')(function* (xmlName: string) {
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

    const loadType = Effect.fn('OrgMetadataResolver.loadType')(function* (orgKey: string, xmlName: string) {
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
            return {
              components: folderComponents.flat(),
              folders: new Set(folders.map(folder => folder.fullName))
            };
          })
        : metadataDescribeService
            .listMetadata(xmlName)
            .pipe(Effect.map(components => ({ components, folders: new Set<string>() })));
      const [orgListing, workspaceUris] = yield* Effect.all(
        [listOrgComponents, scanWorkspace(xmlName).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, URI>())))],
        { concurrency: 'unbounded' }
      );
      const presence = mergePresence({
        orgNames: orgListing.components.map(component => component.fullName),
        workspaceUris
      });
      yield* Effect.all(
        [
          Ref.update(cache, current => new Map(current).set(key, presence)),
          Ref.update(folderCache, current => new Map(current).set(key, orgListing.folders))
        ],
        { discard: true }
      );
      return presence;
    });

    const getPresence = Effect.fn('OrgMetadataResolver.getPresence')(function* (canonicalUri: URI) {
      const location = getOrgMetadataLocation(canonicalUri);
      if (!location?.xmlName || location.componentSegments.length === 0) {
        return emptyPresence();
      }
      const presence = yield* loadType(location.orgKey, location.xmlName);
      return presence.get(location.componentSegments.join('/')) ?? emptyPresence();
    });

    const isInWorkspace = Effect.fn('OrgMetadataResolver.isInWorkspace')(function* (canonicalUri: URI) {
      return (yield* getPresence(canonicalUri)).inWorkspace;
    });

    const hasWorkspaceComponents = Effect.fn('OrgMetadataResolver.hasWorkspaceComponents')(function* (
      canonicalTypeUri: URI
    ) {
      const location = getOrgMetadataLocation(canonicalTypeUri);
      if (!location?.xmlName || location.componentSegments.length > 0) return false;
      const presence = yield* loadType(location.orgKey, location.xmlName);
      return [...presence.values()].some(state => state.inWorkspace);
    });

    const getWorkspaceMetadataTypes = Effect.fn('OrgMetadataResolver.getWorkspaceMetadataTypes')(function* (
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

    const getUriForFile = Effect.fn('OrgMetadataResolver.getUriForFile')(function* (canonicalUri: URI) {
      return (yield* getPresence(canonicalUri)).workspaceUri ?? canonicalUri;
    });

    const fetchApexClass = Effect.fn('OrgMetadataResolver.fetchApexClass')(function* (
      canonicalUri: URI,
      fullName: string
    ) {
      const connection = yield* connectionService.getConnection();
      const nameParts = fullName.split('.');
      const className = nameParts.at(-1) ?? fullName;
      const namespace = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : undefined;
      const namespaceFilter = namespace ? ` AND NamespacePrefix = '${escapeSoql(namespace)}'` : '';
      const query = `SELECT Body, Name, NamespacePrefix FROM ApexClass WHERE Name = '${escapeSoql(className)}'${namespaceFilter} LIMIT 1`;
      const result = yield* Effect.tryPromise({
        try: () => connection.tooling.query<{ Body?: string; Name: string; NamespacePrefix?: string | null }>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new OrgMetadataResolutionError({
            cause,
            message: `Failed to retrieve Apex class '${fullName}' from the org: ${cause.message}`,
            uri: canonicalUri.toString()
          });
        }
      });
      const apexClass = result.records[0];
      if (!apexClass) {
        return yield* new OrgMetadataResolutionError({
          cause: new Error(`Apex class '${fullName}' was not found`),
          message: `Apex class '${fullName}' was not found in the org`,
          uri: canonicalUri.toString()
        });
      }
      if (apexClass.Body?.includes('(hidden)')) {
        return new TextEncoder().encode(`// Source code for managed class '${fullName}' is protected.`);
      }
      if (!apexClass.Body) {
        return new TextEncoder().encode(`// Apex class '${fullName}' has no source body.`);
      }
      return new TextEncoder().encode(apexClass.Body);
    });

    const fetchGenericComponent = Effect.fn('OrgMetadataResolver.fetchGenericComponent')(function* (
      canonicalUri: URI,
      orgKey: string,
      xmlName: string,
      fullName: string
    ) {
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      const outputUri = Utils.joinPath(
        workspace.uri,
        '.sf',
        'orgs',
        orgKey,
        'org-metadata-read',
        encodeURIComponent(xmlName),
        ...fullName.split('/').map(encodeURIComponent)
      );
      const member = { type: xmlName, fullName };
      const componentSet = yield* metadataRetrieveService.buildComponentSet([member]);
      const nonEmptyComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
      yield* fsService.safeDelete(outputUri, { recursive: true });

      return yield* metadataRetrieveService.retrieveComponentSetToDirectory(nonEmptyComponentSet, outputUri).pipe(
        Effect.flatMap(result => {
          const sourceComponent = [...result.components.getSourceComponents()].find(
            component => component.type.name === xmlName && component.fullName === fullName
          );
          const candidatePath =
            sourceComponent?.content ??
            result.components.getComponentFilenamesByNameAndType(member).find(path => !path.endsWith('-meta.xml'));
          if (!candidatePath) {
            return Effect.fail(
              new OrgMetadataResolutionError({
                cause: new Error('Retrieve completed without a readable source file'),
                message: `Retrieved ${xmlName} '${fullName}', but no source file was produced`,
                uri: canonicalUri.toString()
              })
            );
          }
          const sourceUri = URI.from({ scheme: outputUri.scheme, path: URI.file(candidatePath).path });
          return Effect.tryPromise({
            try: () => vscode.workspace.fs.readFile(sourceUri),
            catch: error => {
              const { cause } = unknownToErrorCause(error);
              return new OrgMetadataResolutionError({
                cause,
                message: `Failed to read retrieved ${xmlName} '${fullName}': ${cause.message}`,
                uri: canonicalUri.toString()
              });
            }
          });
        }),
        Effect.ensuring(fsService.safeDelete(outputUri, { recursive: true }))
      );
    });

    const readFile = Effect.fn('OrgMetadataResolver.readFile')(function* (canonicalUri: URI) {
      const location = getOrgMetadataLocation(canonicalUri);
      if (!location?.xmlName || location.componentSegments.length === 0) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(canonicalUri));
      }
      const fullName = location.componentSegments.join('/');
      const presence = yield* loadType(location.orgKey, location.xmlName);
      const state = presence.get(fullName);
      if (!state) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(canonicalUri));
      }
      if (state.workspaceUri) {
        return yield* Effect.tryPromise({
          try: () => vscode.workspace.fs.readFile(state.workspaceUri!),
          catch: error => {
            const { cause } = unknownToErrorCause(error);
            return new OrgMetadataResolutionError({
              cause,
              message: `Failed to read workspace source for ${location.xmlName} '${fullName}': ${cause.message}`,
              uri: canonicalUri.toString()
            });
          }
        });
      }
      if (state.ephemeralContent) return state.ephemeralContent;
      if (!state.inOrg) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(canonicalUri));
      }

      const content =
        location.xmlName === 'ApexClass'
          ? yield* fetchApexClass(canonicalUri, fullName)
          : yield* fetchGenericComponent(canonicalUri, location.orgKey, location.xmlName, fullName);
      yield* Ref.update(cache, current => {
        const key = typeCacheKey(location.orgKey, location.xmlName!);
        const currentType = current.get(key) ?? new Map<string, PresenceState>();
        return new Map(current).set(key, new Map(currentType).set(fullName, { ...state, ephemeralContent: content }));
      });
      return content;
    });

    const download = Effect.fn('OrgMetadataResolver.download')(function* (canonicalUri: URI) {
      const location = getOrgMetadataLocation(canonicalUri);
      if (!location?.xmlName || location.componentSegments.length === 0) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(canonicalUri));
      }
      yield* metadataRetrieveService.retrieve(
        [{ type: location.xmlName, fullName: location.componentSegments.join('/') }],
        { ignoreConflicts: true }
      );
      yield* invalidate();
      return yield* getUriForFile(canonicalUri);
    });

    const readDirectory = Effect.fn('OrgMetadataResolver.readDirectory')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(uri));
      }
      yield* assertCurrentOrg(location.orgKey);
      if (!location.xmlName) {
        const metadataTypes = yield* metadataDescribeService.describe();
        return metadataTypes
          .map(type => type.xmlName)
          .toSorted((left, right) => left.localeCompare(right))
          .map(name => [name, vscode.FileType.Directory] satisfies [string, vscode.FileType]);
      }

      const presence = yield* loadType(location.orgKey, location.xmlName);
      const prefix = location.componentSegments.length > 0 ? `${location.componentSegments.join('/')}/` : '';
      const cachedFolders = (yield* Ref.get(folderCache)).get(typeCacheKey(location.orgKey, location.xmlName));
      const initialChildren =
        location.componentSegments.length === 0
          ? new Map([...(cachedFolders ?? [])].map(folder => [folder, vscode.FileType.Directory]))
          : new Map<string, vscode.FileType>();
      const children = [...presence.keys()].reduce((entries, fullName) => {
        if (!fullName.startsWith(prefix)) return entries;
        const remainder = fullName.slice(prefix.length);
        if (!remainder) return entries;
        const [name, ...descendants] = remainder.split('/');
        entries.set(name, descendants.length > 0 ? vscode.FileType.Directory : vscode.FileType.File);
        return entries;
      }, initialChildren);
      if (children.size === 0 && location.componentSegments.length > 0) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(uri));
      }
      return [...children].toSorted(([left], [right]) => left.localeCompare(right));
    });

    const stat = Effect.fn('OrgMetadataResolver.stat')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      yield* assertCurrentOrg(location.orgKey);
      if (!location.xmlName) return toFileStat(vscode.FileType.Directory);

      const presence = yield* loadType(location.orgKey, location.xmlName);
      if (location.componentSegments.length === 0) return toFileStat(vscode.FileType.Directory);
      const fullName = location.componentSegments.join('/');
      if (presence.has(fullName)) return toFileStat(vscode.FileType.File);
      const cachedFolders = (yield* Ref.get(folderCache)).get(typeCacheKey(location.orgKey, location.xmlName));
      if (location.componentSegments.length === 1 && cachedFolders?.has(fullName)) {
        return toFileStat(vscode.FileType.Directory);
      }
      if ([...presence.keys()].some(name => name.startsWith(`${fullName}/`))) {
        return toFileStat(vscode.FileType.Directory);
      }
      return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
    });

    const invalidate = Effect.fn('OrgMetadataResolver.invalidate')(function* () {
      yield* Effect.all(
        [Ref.set(cache, new Map()), Ref.set(folderCache, new Map()), Ref.set(workspaceTypeCache, new Map())],
        { discard: true }
      );
    });

    return {
      download,
      getPresence,
      getUriForFile,
      getWorkspaceMetadataTypes,
      hasWorkspaceComponents,
      invalidate,
      isInWorkspace,
      readDirectory,
      readFile,
      stat
    };
  })
}) {}
