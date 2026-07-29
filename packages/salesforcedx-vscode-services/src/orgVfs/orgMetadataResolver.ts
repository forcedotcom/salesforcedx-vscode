/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../core/componentSetService';
import { ConnectionService } from '../core/connectionService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { unknownToErrorCause } from '../core/shared';
import { FsService } from '../vscode/fsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { OrgMetadataCatalog } from './orgMetadataCatalog';
import { getOrgMetadataLocation } from './orgMetadataUris';

export class OrgMetadataResolutionError extends Data.TaggedError('OrgMetadataResolutionError')<{
  readonly cause: Error;
  readonly message: string;
  readonly uri: string;
}> {}

const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const toFileStat = (type: vscode.FileType): vscode.FileStat => ({
  type,
  ctime: 0,
  mtime: 0,
  size: 0
});

/**
 * Resolves catalog entries into VS Code filesystem documents.
 *
 * Metadata discovery, relationships, presence, and inventory caching belong to
 * OrgMetadataCatalog. This service owns document content, retrieval, and the
 * filesystem projection only.
 */
export class OrgMetadataResolver extends Effect.Service<OrgMetadataResolver>()('OrgMetadataResolver', {
  accessors: true,
  dependencies: [
    ComponentSetService.Default,
    ConnectionService.Default,
    FsService.Default,
    MetadataRetrieveService.Default,
    OrgMetadataCatalog.Default,
    WorkspaceService.Default
  ],
  effect: Effect.gen(function* () {
    const [
      componentSetService,
      connectionService,
      fsService,
      metadataRetrieveService,
      orgMetadataCatalog,
      workspaceService
    ] = yield* Effect.all([
      ComponentSetService,
      ConnectionService,
      FsService,
      MetadataRetrieveService,
      OrgMetadataCatalog,
      WorkspaceService
    ]);
    const contentCache = yield* Ref.make<ReadonlyMap<string, Uint8Array>>(new Map());

    const getUriForFile = Effect.fn('OrgMetadataResolver.getUriForFile')(function* (canonicalUri: URI) {
      return (yield* orgMetadataCatalog.getPresence(canonicalUri)).workspaceUri ?? canonicalUri;
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
      const presence = yield* orgMetadataCatalog.getPresence(canonicalUri);
      if (!presence.inOrg && !presence.inWorkspace) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(canonicalUri));
      }
      if (presence.workspaceUri) {
        return yield* Effect.tryPromise({
          try: () => vscode.workspace.fs.readFile(presence.workspaceUri!),
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
      const cached = (yield* Ref.get(contentCache)).get(canonicalUri.toString());
      if (cached) return cached;

      const content =
        location.xmlName === 'ApexClass'
          ? yield* fetchApexClass(canonicalUri, fullName)
          : yield* fetchGenericComponent(canonicalUri, location.orgKey, location.xmlName, fullName);
      yield* Ref.update(contentCache, current => new Map(current).set(canonicalUri.toString(), content));
      return content;
    });

    const invalidate = Effect.fn('OrgMetadataResolver.invalidate')(function* () {
      yield* Ref.set(contentCache, new Map());
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
      yield* Effect.all([orgMetadataCatalog.invalidate(), invalidate()], { discard: true });
      return yield* getUriForFile(canonicalUri);
    });

    const readDirectory = Effect.fn('OrgMetadataResolver.readDirectory')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(uri));
      }
      if (location.xmlName && location.componentSegments.length > 0) {
        const entry = yield* orgMetadataCatalog.getEntry(uri);
        if (entry?.kind === 'component') {
          return yield* Effect.fail(vscode.FileSystemError.FileNotADirectory(uri));
        }
      }
      const children = yield* orgMetadataCatalog.getChildren(uri);
      return children.map(
        entry =>
          [entry.name, entry.kind === 'component' ? vscode.FileType.File : vscode.FileType.Directory] satisfies [
            string,
            vscode.FileType
          ]
      );
    });

    const stat = Effect.fn('OrgMetadataResolver.stat')(function* (uri: URI) {
      const location = getOrgMetadataLocation(uri);
      if (!location) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      if (!location.xmlName) {
        yield* orgMetadataCatalog.getChildren(uri);
        return toFileStat(vscode.FileType.Directory);
      }
      const entry = yield* orgMetadataCatalog.getEntry(uri);
      if (!entry) {
        return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      return toFileStat(entry.kind === 'component' ? vscode.FileType.File : vscode.FileType.Directory);
    });

    return {
      download,
      getUriForFile,
      invalidate,
      readDirectory,
      readFile,
      stat
    };
  })
}) {}
