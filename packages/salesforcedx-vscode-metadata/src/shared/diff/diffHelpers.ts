/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { NonEmptyComponentSet, HashableUri } from 'salesforcedx-vscode-services';
import { Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { MissingDefaultOrgError } from './diffErrors';
import { createDiffFilePair, isDiffFilePair, type DiffFilePair } from './diffTypes';

/** Convert file paths to HashableUri set. Uses FsService.toUri for correct scheme (memfs in web). */
export const pathsToHashableUris = Effect.fn('pathsToHashableUris')(function* (paths: string[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  return yield* Stream.fromIterable(paths).pipe(
    Stream.mapEffect(p => fsService.toUri(p)),
    Stream.map(uri => fsService.HashableUri.fromUri(uri)),
    Stream.runCollect,
    Effect.map(HashSet.fromIterable)
  );
});

/** Get cache directory URI for retrieved metadata */
export const getCacheDirectoryUri = Effect.fn('getCacheDirectoryUri')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [workspaceInfo, defaultOrgRef] = yield* Effect.all(
    [api.services.WorkspaceService.getWorkspaceInfoOrThrow(), Effect.succeed(api.services.TargetOrgRef)],
    {
      concurrency: 'unbounded'
    }
  );

  const orgId = (yield* SubscriptionRef.get(yield* defaultOrgRef())).orgId;

  if (!orgId) {
    return yield* new MissingDefaultOrgError({ message: nls.localize('missing_default_org') });
  }

  return Utils.joinPath(workspaceInfo.uri, '.sf', 'orgs', orgId, 'remoteMetadata');
});

/** Retrieve ComponentSet to cache directory */
export const retrieveToCacheDirectory = Effect.fn('retrieveToCacheDirectory')(function* (
  componentSet: NonEmptyComponentSet
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const cacheDirUri = yield* getCacheDirectoryUri();

  yield* api.services.FsService.safeDelete(cacheDirUri, { recursive: true });

  const result = yield* api.services.MetadataRetrieveService.retrieveComponentSetToDirectory(componentSet, cacheDirUri);

  return result;
});

const getParentDir = (uri: HashableUri) => Utils.basename(Utils.dirname(uri));

const createMatchedPair = Effect.fn('createMatchedPair')(function* (props: {
  remoteUris: HashSet.HashSet<HashableUri>;
  projectUri: HashableUri;
}) {
  const { projectUri, remoteUris } = props;
  const projectFileName = Utils.basename(projectUri);
  const projectParentDir = getParentDir(projectUri);
  const matchedRemoteUri = HashSet.toValues(remoteUris).find(
    p => Utils.basename(p) === projectFileName && getParentDir(p) === projectParentDir
  );
  return matchedRemoteUri
    ? createDiffFilePair({ localUri: projectUri, remoteUri: matchedRemoteUri, fileName: projectFileName })
    : yield* Effect.void;
});

/** Match initial URIs to retrieved component file paths */
export const matchUrisToComponents = Effect.fn('matchUrisToComponents')(function* (
  projectUris: HashSet.HashSet<HashableUri>,
  retrievedComponents: SourceComponent[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const remoteUris = yield* Stream.fromIterable(retrievedComponents).pipe(
    Stream.mapConcat(sourceComponentToPaths),
    Stream.mapEffect(p => fsService.toUri(p)),
    Stream.map(uri => fsService.HashableUri.fromUri(uri)),
    Stream.runCollect,
    Effect.map(HashSet.fromIterable)
  );

  yield* Effect.annotateCurrentSpan({ remoteUris, initialUris: [...projectUris].map(u => u.toString()) });

  return yield* Stream.fromIterable(projectUris).pipe(
    Stream.mapEffect(i => createMatchedPair({ remoteUris, projectUri: i })),
    Stream.filter(isDiffFilePair),
    Stream.runCollect,
    Effect.map(HashSet.fromIterable)
  );
});

/** Check if two files differ in content, ignoring whitespace */
export const filesAreNotIdentical = Effect.fn('filesAreNotIdentical')(function* (pair: DiffFilePair) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [buffer1, buffer2] = (yield* Effect.all(
    [api.services.FsService.readFile(pair.remoteUri.toUri()), api.services.FsService.readFile(pair.localUri.toUri())],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.tapError(e => Effect.logWarning('filesAreNotIdentical: readFile failed, skipping pair', e)),
    Effect.orElseSucceed(() => ['', ''] as const)
    // normalize whitespace
  )).map((s: string) => s.replaceAll(/\s+/g, ''));
  return buffer1 !== buffer2;
});

export const sourceComponentToPaths = (component: SourceComponent) =>
  [component.content ?? [], component.xml ?? [], ...component.walkContent()].filter(isString);
