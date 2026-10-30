/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  FsService,
  NonEmptyTrimmedString,
  OrgId,
  SObjectArtifactIdentitySchema,
  SObjectSemanticProjectionSchema,
  WorkspaceService,
  artifactIdentitiesEqual,
  normalizeArtifactIdentityPart,
  normalizeArtifactNamespace
} from '@salesforce/vscode-services-v2';
import * as Clock from 'effect/Clock';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isNull } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import { URI, Utils } from 'vscode-uri';
import { isFileNotFound } from '../errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';

const STAGING_SUFFIX = '.__staging__';
const ORG_SEMANTIC_ARTIFACT_REVISIONS_TO_KEEP = 3;
const SemanticArtifactStoreKeySchema = Schema.Struct({
  orgId: OrgId,
  provider: Schema.Literal('rest-api'),
  capabilityVersion: NonEmptyTrimmedString,
  revision: Schema.NullOr(NonEmptyTrimmedString),
  identity: SObjectArtifactIdentitySchema,
  projection: SObjectSemanticProjectionSchema
});
export type SemanticArtifactStoreKey = typeof SemanticArtifactStoreKeySchema.Type;
const Manifest = Schema.Struct({
  version: Schema.Literal(1),
  key: SemanticArtifactStoreKeySchema,
  writtenAt: Schema.String,
  value: Schema.Unknown
});
/** @ExportTaggedError Required by the persistence service's emitted error channel (TS4020). */
export class SemanticArtifactStoreKeyMismatchError extends Schema.TaggedError<SemanticArtifactStoreKeyMismatchError>()(
  'SemanticArtifactStoreKeyMismatchError',
  { message: Schema.String }
) {}
/** @ExportTaggedError Required by the persistence service's emitted error channel (TS4020). */
export class SemanticArtifactSerializationError extends Schema.TaggedError<SemanticArtifactSerializationError>()(
  'SemanticArtifactSerializationError',
  { message: Schema.String, cause: Schema.Unknown }
) {}
const keysEqual = (left: SemanticArtifactStoreKey, right: SemanticArtifactStoreKey) =>
  left.orgId === right.orgId &&
  artifactIdentitiesEqual(left.identity, right.identity) &&
  left.projection.kind === right.projection.kind &&
  left.projection.model === right.projection.model &&
  left.provider === right.provider &&
  left.capabilityVersion === right.capabilityVersion &&
  left.revision === right.revision;
const encodeSegment = (value: string): string =>
  encodeURIComponent(value)
    .replace(/^\.$/, '%2E')
    .replace(/^\.\.$/, '%2E%2E');
const identitySegments = (key: SemanticArtifactStoreKey) =>
  Effect.try({
    try: () => [
      key.identity.kind,
      ...(isNull(key.identity.namespace)
        ? ['global']
        : ['namespace', encodeSegment(normalizeArtifactNamespace(key.identity.namespace) ?? '')]),
      encodeSegment(normalizeArtifactIdentityPart(key.identity.name)),
      key.projection.model,
      key.provider,
      encodeSegment(key.capabilityVersion),
      'revisions',
      isNull(key.revision) ? 'unversioned.json' : `revision-${encodeSegment(key.revision)}.json`
    ],
    catch: cause =>
      new SemanticArtifactSerializationError({ message: 'Failed to encode semantic artifact path', cause })
  });

const makeOrgSemanticArtifactStore = Effect.gen(function* () {
  const fs = yield* FsService;
  const workspace = yield* WorkspaceService;
  const operations = yield* ServiceOperations;
  const publishPermit = yield* Semaphore.make(1);
  const lastWrittenAt = yield* Ref.make(0);
  const getUri = Effect.fn('OrgSemanticArtifactStore.getUri')(function* (key: SemanticArtifactStoreKey) {
    const info = yield* workspace.getWorkspaceInfoOrThrow();
    return Utils.joinPath(info.uri, '.sf', 'orgs', key.orgId, 'semantic-artifacts', ...(yield* identitySegments(key)));
  });
  const loadManifest = Effect.fn('OrgSemanticArtifactStore.loadManifest')(function* (
    uri: URI,
    expectedKey?: SemanticArtifactStoreKey
  ) {
    const manifest = yield* fs.readJSON(uri.toString(), Manifest);
    if (expectedKey && !keysEqual(manifest.key, expectedKey))
      return yield* new SemanticArtifactStoreKeyMismatchError({
        message: `Stored semantic artifact key does not match '${uri.toString()}'`
      });
    return manifest;
  });
  const load = Effect.fn('OrgSemanticArtifactStore.load')(function* (key: SemanticArtifactStoreKey) {
    const uri = yield* getUri(key);
    const exists = yield* fs.stat(uri).pipe(
      Effect.as(true),
      Effect.catchTag('FsServiceError', error =>
        isFileNotFound(error.cause) ? Effect.succeed(false) : Effect.fail(error)
      )
    );
    if (!exists) return undefined;
    return { ...(yield* loadManifest(uri, key)), uri };
  }, operations.run);
  const pruneRevisions = Effect.fn('OrgSemanticArtifactStore.pruneRevisions')(function* (currentUri: URI) {
    const uris = (yield* fs.readDirectory(Utils.dirname(currentUri))).filter(uri =>
      Utils.basename(uri).endsWith('.json')
    );
    const manifests = (yield* Effect.forEach(
      uris,
      uri =>
        loadManifest(uri).pipe(
          Effect.map(manifest => Option.some({ manifest, uri })),
          Effect.catchTag('FsServiceError', () => Effect.succeed(Option.none()))
        ),
      { concurrency: 'unbounded' }
    )).flatMap(Option.toArray);
    const retained = HashSet.fromIterable([
      currentUri.toString(),
      ...manifests
        .filter(value => value.uri.toString() !== currentUri.toString())
        .toSorted(
          (left, right) =>
            right.manifest.writtenAt.localeCompare(left.manifest.writtenAt) ||
            right.uri.toString().localeCompare(left.uri.toString())
        )
        .slice(0, ORG_SEMANTIC_ARTIFACT_REVISIONS_TO_KEEP - 1)
        .map(value => value.uri.toString())
    ]);
    const stale = manifests.filter(value => !HashSet.has(retained, value.uri.toString()));
    yield* Effect.forEach(stale, value => fs.safeDelete(value.uri).pipe(Effect.uninterruptible), {
      concurrency: 'unbounded',
      discard: true
    });
    yield* Effect.annotateCurrentSpan({
      scannedRevisionCount: uris.length,
      validRevisionCount: manifests.length,
      deletedRevisionCount: stale.length
    });
  });
  const save = Effect.fn('OrgSemanticArtifactStore.save')(
    (key: SemanticArtifactStoreKey, value: unknown) =>
      publishPermit.withPermit(
        Effect.gen(function* () {
          const decodedKey = yield* Schema.decodeUnknownEffect(SemanticArtifactStoreKeySchema)(key);
          const uri = yield* getUri(decodedKey);
          const now = yield* Clock.currentTimeMillis;
          const writtenAt = new Date(
            yield* Ref.updateAndGet(lastWrittenAt, previous => Math.max(now, previous + 1))
          ).toISOString();
          const manifest = { version: 1 as const, key: decodedKey, writtenAt, value };
          const content = yield* Effect.try({
            try: () => JSON.stringify(manifest, null, 2),
            catch: cause =>
              new SemanticArtifactSerializationError({ message: 'Failed to serialize semantic artifact', cause })
          });
          const staging = URI.parse(`${uri.toString()}${STAGING_SUFFIX}`);
          // No native write may outlive its permit or service owner, including caller cancellation.
          yield* fs
            .safeWriteFile(staging, content)
            .pipe(
              Effect.andThen(fs.rename(staging.toString(), uri.toString(), { overwrite: true })),
              Effect.uninterruptible,
              Effect.ensuring(fs.safeDelete(staging))
            );
          yield* pruneRevisions(uri).pipe(
            Effect.catchTag('FsServiceError', error =>
              Effect.logWarning('Failed to prune semantic artifact revisions', error)
            )
          );
          yield* Effect.annotateCurrentSpan({
            orgId: key.orgId,
            name: key.identity.name,
            namespace: key.identity.namespace ?? '',
            projection: key.projection.model,
            capabilityVersion: key.capabilityVersion,
            revision: key.revision ?? ''
          });
          return { key: decodedKey, writtenAt, value, uri };
        })
      ),
    operations.run
  );
  yield* Effect.addFinalizer(() => operations.close);
  return {
    getUri: (key: SemanticArtifactStoreKey) => operations.run(getUri(key)),
    load,
    save,
    pruneRevisions: (uri: URI) => operations.run(publishPermit.withPermit(pruneRevisions(uri)))
  };
});
export class OrgSemanticArtifactStore extends Context.Service<
  OrgSemanticArtifactStore,
  Effect.Success<typeof makeOrgSemanticArtifactStore>
>()('@salesforce/vscode-services-v4-implementation/OrgSemanticArtifactStore') {}
export const OrgSemanticArtifactStoreLayer = Layer.effect(OrgSemanticArtifactStore, makeOrgSemanticArtifactStore).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
