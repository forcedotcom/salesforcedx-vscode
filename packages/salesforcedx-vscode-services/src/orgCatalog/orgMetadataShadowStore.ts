/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataComponentReference } from './orgMetadataReference';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { FsService } from '../vscode/fsService';
import { WorkspaceService } from '../vscode/workspaceService';

const SHADOW_DIRECTORY = 'metadata-shadow';
const SDR_STAGING_DIRECTORY = 'remoteMetadata';
const CATALOG_STAGING_DIRECTORY = 'catalog-staging';
const MANIFEST_FILE = '.catalog.json';
export const ORG_METADATA_SHADOW_REVISIONS_TO_KEEP = 3;

const ShadowManifest = Schema.Struct({
  version: Schema.Literal(1),
  xmlName: Schema.String,
  fullName: Schema.String,
  primaryPath: Schema.String,
  files: Schema.Array(Schema.String),
  remoteLastModifiedDate: Schema.optional(Schema.String),
  materializedAt: Schema.String
});

type ShadowManifest = typeof ShadowManifest.Type;

export type OrgMetadataShadowArtifact = {
  readonly rootUri: URI;
  readonly primaryUri: URI;
  readonly fileUris: readonly URI[];
  readonly remoteLastModifiedDate?: string;
  readonly materializedAt: string;
};

const encodedSegments = (value: string): string[] => value.split('/').map(encodeURIComponent);

const relativePath = (root: URI, child: URI): string | undefined => {
  const prefix = root.path.endsWith('/') ? root.path : `${root.path}/`;
  return child.path.startsWith(prefix) ? child.path.slice(prefix.length) : undefined;
};

const containsUri = (root: URI, child: URI): boolean =>
  root.scheme === child.scheme && (child.path === root.path || child.path.startsWith(`${root.path}/`));

export const isOrgMetadataShadowUri = (workspaceUri: URI, uri: URI): boolean => {
  const root = Utils.joinPath(workspaceUri, '.sf', 'orgs');
  return (
    uri.scheme === root.scheme &&
    uri.path.startsWith(`${root.path}/`) &&
    (uri.path.includes(`/${SHADOW_DIRECTORY}/`) ||
      uri.path.includes(`/${SDR_STAGING_DIRECTORY}/${CATALOG_STAGING_DIRECTORY}/`))
  );
};

export class OrgMetadataShadowStore extends Effect.Service<OrgMetadataShadowStore>()('OrgMetadataShadowStore', {
  accessors: true,
  dependencies: [FsService.Default, WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const [fsService, workspaceService] = yield* Effect.all([FsService, WorkspaceService]);

    const getRootUri = Effect.fn('OrgMetadataShadowStore.getRootUri')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference,
      remoteLastModifiedDate?: string
    ) {
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      return Utils.joinPath(
        workspace.uri,
        '.sf',
        'orgs',
        encodeURIComponent(orgId),
        SHADOW_DIRECTORY,
        encodeURIComponent(reference.xmlName),
        ...encodedSegments(reference.fullName),
        'revisions',
        encodeURIComponent(remoteLastModifiedDate ?? 'unversioned')
      );
    });

    const toArtifact = (rootUri: URI, manifest: ShadowManifest) =>
      Effect.gen(function* () {
        const primaryUri = Utils.joinPath(rootUri, ...manifest.primaryPath.split('/'));
        if (!(yield* fsService.fileOrFolderExists(primaryUri))) return undefined;
        return {
          rootUri,
          primaryUri,
          fileUris: manifest.files.map(file => Utils.joinPath(rootUri, ...file.split('/'))),
          remoteLastModifiedDate: manifest.remoteLastModifiedDate,
          materializedAt: manifest.materializedAt
        };
      });

    const get = Effect.fn('OrgMetadataShadowStore.get')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference,
      expectedRemoteLastModifiedDate?: string
    ) {
      const rootUri = yield* getRootUri(orgId, reference, expectedRemoteLastModifiedDate);
      const manifest = yield* fsService
        .readJSON(Utils.joinPath(rootUri, MANIFEST_FILE).toString(), ShadowManifest)
        .pipe(Effect.option);
      if (manifest._tag === 'None') return undefined;
      if (
        manifest.value.xmlName !== reference.xmlName ||
        manifest.value.fullName !== reference.fullName ||
        manifest.value.remoteLastModifiedDate !== expectedRemoteLastModifiedDate
      ) {
        return undefined;
      }
      return yield* toArtifact(rootUri, manifest.value);
    });

    const prepare = Effect.fn('OrgMetadataShadowStore.prepare')(function* (
      orgId: string,
      reference: OrgMetadataComponentReference,
      remoteLastModifiedDate?: string
    ) {
      const rootUri = yield* getRootUri(orgId, reference, remoteLastModifiedDate);
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      // SDR's built-in ForceIgnore rules permit source conversion only beneath
      // .sf/orgs/<org>/remoteMetadata. The completed artifact is then moved to
      // the catalog-owned metadata-shadow tree.
      const stagingUri = Utils.joinPath(
        workspace.uri,
        '.sf',
        'orgs',
        encodeURIComponent(orgId),
        SDR_STAGING_DIRECTORY,
        CATALOG_STAGING_DIRECTORY,
        encodeURIComponent(reference.xmlName),
        ...encodedSegments(reference.fullName),
        `${encodeURIComponent(remoteLastModifiedDate ?? 'unversioned')}.__staging__`
      );
      yield* fsService.safeDelete(stagingUri, { recursive: true });
      yield* fsService.createDirectory(stagingUri);
      return { rootUri, stagingUri };
    });

    const prepareBatch = Effect.fn('OrgMetadataShadowStore.prepareBatch')(function* (orgId: string) {
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      const stagingUri = Utils.joinPath(
        workspace.uri,
        '.sf',
        'orgs',
        encodeURIComponent(orgId),
        SDR_STAGING_DIRECTORY,
        CATALOG_STAGING_DIRECTORY,
        'batch.__staging__'
      );
      yield* fsService.safeDelete(stagingUri, { recursive: true });
      yield* fsService.createDirectory(stagingUri);
      return stagingUri;
    });

    const pruneRevisions = Effect.fn('OrgMetadataShadowStore.pruneRevisions')(function* (currentRootUri: URI) {
      const revisionsUri = Utils.dirname(currentRootUri);
      const revisionRoots = (yield* fsService.readDirectory(revisionsUri)).filter(
        uri => !Utils.basename(uri).endsWith('.__staging__')
      );
      const manifests = (yield* Effect.forEach(
        revisionRoots,
        rootUri =>
          fsService.readJSON(Utils.joinPath(rootUri, MANIFEST_FILE).toString(), ShadowManifest).pipe(
            Effect.option,
            Effect.map(manifest => ({ manifest, rootUri }))
          ),
        { concurrency: 'unbounded' }
      )).flatMap(({ manifest, rootUri }) => (manifest._tag === 'Some' ? [{ manifest: manifest.value, rootUri }] : []));
      const protectedRoots = new Set(
        vscode.workspace.textDocuments.flatMap(document => {
          const openUri = URI.parse(document.uri.toString());
          const root = manifests.find(candidate => containsUri(candidate.rootUri, openUri))?.rootUri;
          return root ? [root.toString()] : [];
        })
      );
      const retainedRoots = new Set([
        currentRootUri.toString(),
        ...manifests
          .filter(candidate => candidate.rootUri.toString() !== currentRootUri.toString())
          .toSorted(
            (left, right) =>
              right.manifest.materializedAt.localeCompare(left.manifest.materializedAt) ||
              right.rootUri.toString().localeCompare(left.rootUri.toString())
          )
          .slice(0, ORG_METADATA_SHADOW_REVISIONS_TO_KEEP - 1)
          .map(candidate => candidate.rootUri.toString()),
        ...protectedRoots
      ]);
      const staleRoots = manifests
        .map(candidate => candidate.rootUri)
        .filter(rootUri => !retainedRoots.has(rootUri.toString()));
      yield* Effect.forEach(staleRoots, rootUri => fsService.safeDelete(rootUri, { recursive: true }), {
        concurrency: 'unbounded',
        discard: true
      });
      yield* Effect.annotateCurrentSpan({
        scannedRevisionCount: revisionRoots.length,
        validRevisionCount: manifests.length,
        protectedRevisionCount: protectedRoots.size,
        deletedRevisionCount: staleRoots.length
      });
    });

    const publish = Effect.fn('OrgMetadataShadowStore.publish')(function* ({
      orgId,
      reference,
      stagingUri,
      primaryUri,
      fileUris,
      remoteLastModifiedDate
    }: {
      readonly orgId: string;
      readonly reference: OrgMetadataComponentReference;
      readonly stagingUri: URI;
      readonly primaryUri: URI;
      readonly fileUris: readonly URI[];
      readonly remoteLastModifiedDate?: string;
    }) {
      const rootUri = yield* getRootUri(orgId, reference, remoteLastModifiedDate);
      const primaryPath = relativePath(stagingUri, primaryUri);
      const files = fileUris.flatMap(file => {
        const path = relativePath(stagingUri, file);
        return path ? [path] : [];
      });
      if (!primaryPath) {
        return yield* Effect.die(
          new Error(`Primary shadow document is outside staging root: ${primaryUri.toString()}`)
        );
      }
      const manifest: ShadowManifest = {
        version: 1,
        xmlName: reference.xmlName,
        fullName: reference.fullName,
        primaryPath,
        files,
        remoteLastModifiedDate,
        materializedAt: new Date().toISOString()
      };
      yield* fsService.safeWriteFile(
        Utils.joinPath(stagingUri, MANIFEST_FILE),
        yield* Schema.encode(Schema.parseJson(ShadowManifest))(manifest)
      );
      yield* fsService.safeDelete(rootUri, { recursive: true });
      yield* fsService.rename(stagingUri.toString(), rootUri.toString());
      const artifact = yield* toArtifact(rootUri, manifest);
      yield* pruneRevisions(rootUri).pipe(
        Effect.catchAll(error => Effect.logWarning('Failed to prune metadata shadow revisions', error))
      );
      return artifact;
    });

    return {
      get,
      getRootUri,
      prepare,
      prepareBatch,
      pruneRevisions,
      publish
    };
  })
}) {}
