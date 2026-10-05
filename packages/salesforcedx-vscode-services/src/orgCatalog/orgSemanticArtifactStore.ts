/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { URI, Utils } from 'vscode-uri';
import {
  SObjectArtifactIdentitySchema,
  artifactIdentitiesEqual,
  normalizeArtifactIdentityPart,
  normalizeArtifactNamespace
} from '../core/artifactIdentity';
import { SObjectSemanticProjectionSchema } from '../core/artifactProjection';
import { FsService } from '../vscode/fsService';
import { WorkspaceService } from '../vscode/workspaceService';

const SEMANTIC_ARTIFACT_DIRECTORY = 'semantic-artifacts';
const SEMANTIC_ARTIFACT_MANIFEST_VERSION = 1;
const STAGING_SUFFIX = '.__staging__';
export const ORG_SEMANTIC_ARTIFACT_REVISIONS_TO_KEEP = 3;

const SemanticArtifactProviderSchema = Schema.Literal('rest-api');

const SemanticArtifactStoreKeyFields = {
  orgId: Schema.NonEmptyTrimmedString,
  provider: SemanticArtifactProviderSchema,
  capabilityVersion: Schema.NonEmptyTrimmedString,
  revision: Schema.NullOr(Schema.NonEmptyTrimmedString)
} as const;

const SemanticArtifactStoreKeySchema = Schema.Struct({
  ...SemanticArtifactStoreKeyFields,
  identity: SObjectArtifactIdentitySchema,
  projection: SObjectSemanticProjectionSchema
});
export type SemanticArtifactStoreKey = typeof SemanticArtifactStoreKeySchema.Type;

const SemanticArtifactManifestSchema = Schema.Struct({
  version: Schema.Literal(SEMANTIC_ARTIFACT_MANIFEST_VERSION),
  key: SemanticArtifactStoreKeySchema,
  writtenAt: Schema.String,
  value: Schema.Unknown
});

type SemanticArtifactManifest = typeof SemanticArtifactManifestSchema.Type;

class SemanticArtifactStoreKeyMismatchError extends Schema.TaggedError<SemanticArtifactStoreKeyMismatchError>()(
  'SemanticArtifactStoreKeyMismatchError',
  { message: Schema.String }
) {}

class SemanticArtifactSerializationError extends Schema.TaggedError<SemanticArtifactSerializationError>()(
  'SemanticArtifactSerializationError',
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

const keysEqual = (left: SemanticArtifactStoreKey, right: SemanticArtifactStoreKey): boolean =>
  left.orgId === right.orgId &&
  artifactIdentitiesEqual(left.identity, right.identity) &&
  left.projection.kind === right.projection.kind &&
  left.projection.model === right.projection.model &&
  left.provider === right.provider &&
  left.capabilityVersion === right.capabilityVersion &&
  left.revision === right.revision;

const encodedIdentitySegments = (key: SemanticArtifactStoreKey): readonly string[] => [
  key.identity.kind,
  ...(key.identity.namespace === null
    ? ['global']
    : ['namespace', encodeURIComponent(normalizeArtifactNamespace(key.identity.namespace) ?? '')]),
  encodeURIComponent(normalizeArtifactIdentityPart(key.identity.name)),
  key.projection.model,
  key.provider,
  encodeURIComponent(key.capabilityVersion),
  'revisions'
];

const revisionFileName = (revision: string | null): string =>
  revision === null ? 'unversioned.json' : `revision-${encodeURIComponent(revision)}.json`;

const serializeManifest = (manifest: SemanticArtifactManifest) =>
  Effect.try({
    try: () => JSON.stringify(manifest, null, 2),
    catch: cause =>
      new SemanticArtifactSerializationError({
        message: 'Failed to serialize semantic artifact',
        cause
      })
  });

/** Durable, org-isolated storage primitive for opaque semantic projection payloads. */
export class OrgSemanticArtifactStore extends Effect.Service<OrgSemanticArtifactStore>()('OrgSemanticArtifactStore', {
  accessors: true,
  dependencies: [FsService.Default, WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const [fsService, workspaceService] = yield* Effect.all([FsService, WorkspaceService]);
    const publishSemaphore = yield* Effect.makeSemaphore(1);

    const getUri = Effect.fn('OrgSemanticArtifactStore.getUri')(function* (key: SemanticArtifactStoreKey) {
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      return Utils.joinPath(
        workspace.uri,
        '.sf',
        'orgs',
        encodeURIComponent(key.orgId),
        SEMANTIC_ARTIFACT_DIRECTORY,
        ...encodedIdentitySegments(key),
        revisionFileName(key.revision)
      );
    });

    const loadManifest = Effect.fn('OrgSemanticArtifactStore.loadManifest')(function* (
      uri: URI,
      expectedKey?: SemanticArtifactStoreKey
    ) {
      const manifest = yield* fsService.readJSON(uri.toString(), SemanticArtifactManifestSchema);
      if (expectedKey && !keysEqual(manifest.key, expectedKey)) {
        return yield* new SemanticArtifactStoreKeyMismatchError({
          message: `Stored semantic artifact key does not match '${uri.toString()}'`
        });
      }
      return manifest;
    });

    const load = Effect.fn('OrgSemanticArtifactStore.load')(function* (key: SemanticArtifactStoreKey) {
      const uri = yield* getUri(key);
      if (!(yield* fsService.fileOrFolderExists(uri))) return undefined;
      const manifest = yield* loadManifest(uri, key);
      return { key: manifest.key, writtenAt: manifest.writtenAt, value: manifest.value, uri };
    });

    const pruneRevisions = Effect.fn('OrgSemanticArtifactStore.pruneRevisions')(function* (currentUri: URI) {
      const revisionsUri = Utils.dirname(currentUri);
      const revisionUris = (yield* fsService.readDirectory(revisionsUri)).filter(
        uri => Utils.basename(uri).endsWith('.json') && !Utils.basename(uri).endsWith(STAGING_SUFFIX)
      );
      const manifests = (yield* Effect.forEach(
        revisionUris,
        uri =>
          loadManifest(uri).pipe(
            Effect.option,
            Effect.map(manifest => ({ manifest, uri }))
          ),
        { concurrency: 'unbounded' }
      )).flatMap(({ manifest, uri }) => (Option.isSome(manifest) ? [{ manifest: manifest.value, uri }] : []));
      const retainedUris = new Set([
        currentUri.toString(),
        ...manifests
          .filter(candidate => candidate.uri.toString() !== currentUri.toString())
          .toSorted(
            (left, right) =>
              right.manifest.writtenAt.localeCompare(left.manifest.writtenAt) ||
              right.uri.toString().localeCompare(left.uri.toString())
          )
          .slice(0, ORG_SEMANTIC_ARTIFACT_REVISIONS_TO_KEEP - 1)
          .map(candidate => candidate.uri.toString())
      ]);
      const staleUris = manifests.map(candidate => candidate.uri).filter(uri => !retainedUris.has(uri.toString()));
      yield* Effect.forEach(staleUris, uri => fsService.safeDelete(uri), {
        concurrency: 'unbounded',
        discard: true
      });
      yield* Effect.annotateCurrentSpan({
        scannedRevisionCount: revisionUris.length,
        validRevisionCount: manifests.length,
        deletedRevisionCount: staleUris.length
      });
    });

    const save = Effect.fn('OrgSemanticArtifactStore.save')(function* (key: SemanticArtifactStoreKey, value: unknown) {
      return yield* publishSemaphore.withPermits(1)(
        Effect.gen(function* () {
          const decodedKey = yield* Schema.decodeUnknown(SemanticArtifactStoreKeySchema)(key);
          const uri = yield* getUri(decodedKey);
          const stagingUri = URI.parse(`${uri.toString()}${STAGING_SUFFIX}`);
          const manifest: SemanticArtifactManifest = {
            version: SEMANTIC_ARTIFACT_MANIFEST_VERSION,
            key: decodedKey,
            writtenAt: new Date().toISOString(),
            value
          };
          const content = yield* serializeManifest(manifest);
          yield* fsService.safeDelete(stagingUri);
          yield* fsService.safeWriteFile(stagingUri, content);
          yield* fsService.rename(stagingUri.toString(), uri.toString(), { overwrite: true });
          yield* pruneRevisions(uri).pipe(
            Effect.catchAll(error => Effect.logWarning('Failed to prune semantic artifact revisions', error))
          );
          yield* Effect.annotateCurrentSpan({
            orgId: decodedKey.orgId,
            targetKind: decodedKey.identity.kind,
            namespace: decodedKey.identity.namespace ?? '',
            name: decodedKey.identity.name,
            projection: decodedKey.projection.model,
            provider: decodedKey.provider,
            capabilityVersion: decodedKey.capabilityVersion,
            revision: decodedKey.revision ?? ''
          });
          return { key: decodedKey, writtenAt: manifest.writtenAt, value, uri };
        })
      );
    });

    return { getUri, load, pruneRevisions, save };
  })
}) {}
