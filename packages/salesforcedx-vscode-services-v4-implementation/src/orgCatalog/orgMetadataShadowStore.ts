/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  FsService,
  HashableUri,
  OrgMetadataCatalogError,
  WorkspaceService,
  type OrgId,
  type OrgMetadataComponentReference
} from '@salesforce/vscode-services-v2';
import {
  isUriEqualOrWithin,
  pathSuffixWithin,
  uriPathIncludesSegments
} from '@salesforce/vscode-services-v2/uriComparison';
import * as Clock from 'effect/Clock';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { isFileNotFound } from '../errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';

const SHADOW_DIRECTORY = 'metadata-shadow';
const SDR_STAGING_DIRECTORY = 'remoteMetadata';
const CATALOG_STAGING_DIRECTORY = 'catalog-staging';
const MANIFEST_FILE = '.catalog.json';
const ORG_METADATA_SHADOW_REVISIONS_TO_KEEP = 3;
const Manifest = Schema.Struct({
  version: Schema.Literal(1),
  xmlName: Schema.String,
  fullName: Schema.String,
  primaryPath: Schema.String,
  files: Schema.Array(Schema.String),
  remoteLastModifiedDate: Schema.optional(Schema.String),
  materializedAt: Schema.String
});
type ShadowManifest = typeof Manifest.Type;
export const isOrgMetadataShadowUri = (workspaceUri: URI, uri: URI) =>
  isUriEqualOrWithin(Utils.joinPath(workspaceUri, '.sf', 'orgs'), uri) &&
  (uriPathIncludesSegments(uri, [SHADOW_DIRECTORY]) ||
    uriPathIncludesSegments(uri, [SDR_STAGING_DIRECTORY, CATALOG_STAGING_DIRECTORY]));
const encodeSegment = (value: string) =>
  Effect.try({
    try: () =>
      encodeURIComponent(value)
        .replace(/^\.$/, '%2E')
        .replace(/^\.\.$/, '%2E%2E'),
    catch: cause => new OrgMetadataCatalogError({ message: 'Failed to encode metadata shadow path', cause })
  });
type PublishInput = {
  readonly orgId: OrgId;
  readonly reference: OrgMetadataComponentReference;
  readonly stagingUri: URI;
  readonly primaryUri: URI;
  readonly fileUris: readonly URI[];
  readonly remoteLastModifiedDate?: string;
};

const makeOrgMetadataShadowStore = Effect.gen(function* () {
  const fs = yield* FsService;
  const workspace = yield* WorkspaceService;
  const operations = yield* ServiceOperations;
  const permit = yield* Semaphore.make(1);
  const lastMaterializedAt = yield* Ref.make(0);
  const stagingSequence = yield* Ref.make(0);
  const exists = (uri: URI) =>
    fs.stat(uri).pipe(
      Effect.as(true),
      Effect.catchTag('FsServiceError', error =>
        isFileNotFound(error.cause) ? Effect.succeed(false) : Effect.fail(error)
      )
    );
  const getUnusedSiblingUri = Effect.fn('OrgMetadataShadowStore.getUnusedSiblingUri')(function* (
    root: URI,
    suffix: '.__backup__' | '.__staging__'
  ) {
    const candidate = yield* Ref.updateAndGet(stagingSequence, value => value + 1).pipe(
      Effect.flatMap(sequence => {
        const uri = Utils.joinPath(Utils.dirname(root), `${Utils.basename(root)}.${sequence}${suffix}`);
        return exists(uri).pipe(Effect.map(present => ({ uri, exists: present })));
      }),
      Effect.repeat({ while: value => value.exists })
    );
    return candidate.uri;
  });
  const getRootUri = Effect.fn('OrgMetadataShadowStore.getRootUri')(function* (
    orgId: OrgId,
    reference: OrgMetadataComponentReference,
    revision?: string
  ) {
    const info = yield* workspace.getWorkspaceInfoOrThrow();
    return Utils.joinPath(
      info.uri,
      '.sf',
      'orgs',
      orgId,
      SHADOW_DIRECTORY,
      yield* encodeSegment(reference.xmlName),
      ...(yield* Effect.forEach(reference.fullName.split('/'), encodeSegment)),
      'revisions',
      yield* encodeSegment(revision ?? 'unversioned')
    );
  });
  const toArtifact = Effect.fn('OrgMetadataShadowStore.toArtifact')(function* (rootUri: URI, manifest: ShadowManifest) {
    const primaryUri = Utils.joinPath(rootUri, ...manifest.primaryPath.split('/'));
    const fileUris = manifest.files.map(path => Utils.joinPath(rootUri, ...path.split('/')));
    if (!pathSuffixWithin(rootUri, primaryUri) || fileUris.some(uri => !pathSuffixWithin(rootUri, uri)))
      return yield* new OrgMetadataCatalogError({
        message: 'Invalid metadata shadow manifest path',
        cause: manifest
      });
    if (!(yield* fs.fileOrFolderExists(primaryUri))) return undefined;
    return {
      rootUri,
      primaryUri,
      fileUris,
      remoteLastModifiedDate: manifest.remoteLastModifiedDate,
      materializedAt: manifest.materializedAt
    };
  });
  const get = Effect.fn('OrgMetadataShadowStore.get')(
    (orgId: OrgId, reference: OrgMetadataComponentReference, expectedRevision?: string) =>
      permit.withPermit(
        Effect.gen(function* () {
          const root = yield* getRootUri(orgId, reference, expectedRevision);
          const manifest = yield* fs.readJSON(Utils.joinPath(root, MANIFEST_FILE).toString(), Manifest).pipe(
            Effect.map(Option.some),
            Effect.catchTag('FsServiceError', () => Effect.succeed(Option.none()))
          );
          if (
            Option.isNone(manifest) ||
            manifest.value.xmlName !== reference.xmlName ||
            manifest.value.fullName !== reference.fullName ||
            manifest.value.remoteLastModifiedDate !== expectedRevision
          )
            return undefined;
          return yield* toArtifact(root, manifest.value);
        })
      ),
    operations.run
  );
  const prepare = Effect.fn('OrgMetadataShadowStore.prepare')(function* (
    orgId: OrgId,
    reference: OrgMetadataComponentReference,
    revision?: string
  ) {
    const rootUri = yield* getRootUri(orgId, reference, revision);
    const info = yield* workspace.getWorkspaceInfoOrThrow();
    // SDR's ForceIgnore permits conversion beneath remoteMetadata, not metadata-shadow.
    const stagingUri = yield* getUnusedSiblingUri(
      Utils.joinPath(
        info.uri,
        '.sf',
        'orgs',
        orgId,
        SDR_STAGING_DIRECTORY,
        CATALOG_STAGING_DIRECTORY,
        yield* encodeSegment(reference.xmlName),
        ...(yield* Effect.forEach(reference.fullName.split('/'), encodeSegment)),
        yield* encodeSegment(revision ?? 'unversioned')
      ),
      '.__staging__'
    );
    yield* fs.createDirectory(stagingUri).pipe(Effect.uninterruptible);
    return { rootUri, stagingUri };
  }, operations.run);
  const prepareBatch = Effect.fn('OrgMetadataShadowStore.prepareBatch')(function* (orgId: OrgId) {
    const info = yield* workspace.getWorkspaceInfoOrThrow();
    const uri = yield* getUnusedSiblingUri(
      Utils.joinPath(info.uri, '.sf', 'orgs', orgId, SDR_STAGING_DIRECTORY, CATALOG_STAGING_DIRECTORY, 'batch'),
      '.__staging__'
    );
    yield* fs.createDirectory(uri).pipe(Effect.uninterruptible);
    return uri;
  }, operations.run);
  const pruneRevisions = Effect.fn('OrgMetadataShadowStore.pruneRevisions')(function* (currentRoot: URI) {
    const roots = (yield* fs.readDirectory(Utils.dirname(currentRoot))).filter(
      uri => !Utils.basename(uri).endsWith('.__staging__') && !Utils.basename(uri).endsWith('.__backup__')
    );
    const manifests = (yield* Effect.forEach(
      roots,
      rootUri =>
        fs.readJSON(Utils.joinPath(rootUri, MANIFEST_FILE).toString(), Manifest).pipe(
          Effect.map(manifest => Option.some({ manifest, rootUri: HashableUri.fromUri(rootUri) })),
          Effect.catchTag('FsServiceError', () => Effect.succeed(Option.none()))
        ),
      { concurrency: 'unbounded' }
    )).flatMap(Option.toArray);
    const current = HashableUri.fromUri(currentRoot);
    const protectedRoots = vscode.workspace.textDocuments.flatMap(document =>
      manifests
        .filter(candidate => isUriEqualOrWithin(candidate.rootUri.uri, URI.parse(document.uri.toString())))
        .map(candidate => candidate.rootUri)
    );
    const retained = HashSet.fromIterable([
      current,
      ...protectedRoots,
      ...manifests
        .filter(candidate => !Equal.equals(candidate.rootUri, current))
        .toSorted(
          (left, right) =>
            right.manifest.materializedAt.localeCompare(left.manifest.materializedAt) ||
            left.rootUri.uri.path.localeCompare(right.rootUri.uri.path)
        )
        .slice(0, ORG_METADATA_SHADOW_REVISIONS_TO_KEEP - 1)
        .map(candidate => candidate.rootUri)
    ]);
    const stale = manifests.filter(candidate => !HashSet.has(retained, candidate.rootUri));
    yield* Effect.forEach(
      stale,
      candidate => fs.safeDelete(candidate.rootUri.uri, { recursive: true }).pipe(Effect.uninterruptible),
      { concurrency: 'unbounded', discard: true }
    );
    yield* Effect.annotateCurrentSpan({
      scannedRevisionCount: roots.length,
      validRevisionCount: manifests.length,
      protectedRevisionCount: protectedRoots.length,
      deletedRevisionCount: stale.length
    });
  });
  const publish = Effect.fn('OrgMetadataShadowStore.publish')(
    (input: PublishInput) =>
      permit.withPermit(
        Effect.gen(function* () {
          const root = yield* getRootUri(input.orgId, input.reference, input.remoteLastModifiedDate);
          const primaryPath = pathSuffixWithin(input.stagingUri, input.primaryUri);
          const files = input.fileUris.map(uri => pathSuffixWithin(input.stagingUri, uri));
          if (
            !isUriEqualOrWithin(input.stagingUri, input.primaryUri) ||
            input.fileUris.some(uri => !isUriEqualOrWithin(input.stagingUri, uri)) ||
            !primaryPath ||
            files.some(path => !path)
          )
            return yield* new OrgMetadataCatalogError({
              reference: input.reference,
              message: 'Retrieved source file is outside its staging directory',
              cause: input.primaryUri.toString()
            });
          // A successful rename alone does not prove a readable replacement. Never discard an old revision for missing output.
          yield* Effect.forEach([input.primaryUri, ...input.fileUris], uri => fs.stat(uri), { discard: true });
          const now = yield* Clock.currentTimeMillis;
          const manifest: ShadowManifest = {
            version: 1,
            ...input.reference,
            primaryPath,
            files: files.filter((path): path is string => Boolean(path)),
            remoteLastModifiedDate: input.remoteLastModifiedDate,
            materializedAt: new Date(
              yield* Ref.updateAndGet(lastMaterializedAt, previous => Math.max(now, previous + 1))
            ).toISOString()
          };
          const content = JSON.stringify(yield* Schema.encodeEffect(Manifest)(manifest), null, 2);
          const backup = yield* getUnusedSiblingUri(root, '.__backup__');
          // Readers share the publication permit; failed replacement restores the previous complete revision.
          const artifact = yield* Effect.gen(function* () {
            yield* fs.safeWriteFile(Utils.joinPath(input.stagingUri, MANIFEST_FILE), content);
            yield* fs.createDirectory(Utils.dirname(root));
            const existing = yield* exists(root);
            if (existing) yield* fs.rename(root.toString(), backup.toString());
            const published = yield* fs.rename(input.stagingUri.toString(), root.toString()).pipe(
              Effect.andThen(toArtifact(root, manifest)),
              Effect.flatMap(value =>
                value
                  ? Effect.succeed(value)
                  : Effect.fail(
                      new OrgMetadataCatalogError({
                        reference: input.reference,
                        message: 'Published metadata shadow has no readable primary file',
                        cause: input.primaryUri.toString()
                      })
                    )
              ),
              Effect.onError(() =>
                fs
                  .safeDelete(root, { recursive: true })
                  .pipe(
                    Effect.andThen(
                      existing ? fs.rename(backup.toString(), root.toString()).pipe(Effect.orDie) : Effect.void
                    )
                  )
              )
            );
            yield* fs.safeDelete(backup, { recursive: true });
            return published;
          }).pipe(Effect.uninterruptible);
          yield* pruneRevisions(root).pipe(
            Effect.catchTag('FsServiceError', error =>
              Effect.logWarning('Failed to prune metadata shadow revisions', error)
            )
          );
          return artifact;
        })
      ),
    operations.run
  );
  yield* Effect.addFinalizer(() => operations.close);
  return { get, prepare, prepareBatch, publish };
});
export class OrgMetadataShadowStore extends Context.Service<
  OrgMetadataShadowStore,
  Effect.Success<typeof makeOrgMetadataShadowStore>
>()('@salesforce/vscode-services-v4-implementation/OrgMetadataShadowStore') {}
export const OrgMetadataShadowStoreLayer = Layer.effect(OrgMetadataShadowStore, makeOrgMetadataShadowStore).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
