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
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { NonEmptyComponentSet, HashableUri } from 'salesforcedx-vscode-services';
import { Utils } from 'vscode-uri';
import { nls } from '../../messages';

/** Convert file paths to HashableUri set. Uses FsService.toUri for correct scheme (memfs in web). */
export const pathsToHashableUris = Effect.fn('pathsToHashableUris')(function* (paths: string[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  return yield* Stream.fromIterable(paths).pipe(
    Stream.mapEffect(p => api.services.FsService.toUri(p)),
    Stream.map(uri => fsService.HashableUri.fromUri(uri)),
    Stream.runCollect,
    Effect.map(HashSet.fromIterable)
  );
});

import { MissingDefaultOrgError } from './diffErrors';
import { createDiffFilePair, isDiffFilePair, type DiffFilePair } from './diffTypes';

/** Get cache directory URI for retrieved metadata */
const getCacheDirectoryUri = Effect.fn('getCacheDirectoryUri')(function* () {
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

  return typeof result === 'string' ? undefined : result;
});

const createMatchedPair = Effect.fn('createMatchedPair')(function* (props: {
  allRemotePaths: string[];
  initialUri: HashableUri;
  fileName: string;
}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const { initialUri, fileName, allRemotePaths } = props;
  const matchingPath = allRemotePaths.find(path => path.endsWith(fileName));
  return matchingPath
    ? createDiffFilePair({
        localUri: initialUri,
        remoteUri: yield* api.services.FsService.toUri(matchingPath).pipe(
          Effect.map(uri => fsService.HashableUri.fromUri(uri))
        ),
        fileName
      })
    : yield* Effect.void;
});

/** Match initial URIs to retrieved component file paths */
export const matchUrisToComponents = Effect.fn('matchUrisToComponents')(function* (
  initialUris: HashSet.HashSet<HashableUri>,
  retrievedComponents: SourceComponent[]
) {
  const allRemotePaths = Array.from(new Set<string>(retrievedComponents.flatMap(sourceComponentToPaths)));

  yield* Effect.annotateCurrentSpan({ allRemotePaths, initialUris: [...initialUris].map(u => u.toString()) });

  return yield* Stream.fromIterable(initialUris).pipe(
    Stream.map(initialUri => ({ initialUri, fileName: Utils.basename(initialUri) })),
    Stream.filter(i => isNotUndefined(i.fileName)),
    Stream.mapEffect(i => createMatchedPair({ allRemotePaths, initialUri: i.initialUri, fileName: i.fileName })),
    Stream.filter(isDiffFilePair),
    Stream.runCollect,
    Effect.map(HashSet.fromIterable)
  );
});

/** Check if two files differ in content */
export const filesAreNotIdentical = Effect.fn('filesAreNotIdentical')(function* (pair: DiffFilePair) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [buffer1, buffer2] = yield* Effect.all(
    [api.services.FsService.readFile(pair.remoteUri), api.services.FsService.readFile(pair.localUri)],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.tapError(e => Effect.logWarning('filesAreNotIdentical: readFile failed, skipping pair', e)),
    Effect.orElseSucceed(() => ['', ''] as const)
  );
  return buffer1 !== buffer2;
});

export const sourceComponentToPaths = (component: SourceComponent) =>
  [component.content ?? [], component.xml ?? [], ...component.walkContent()].filter(isString);
