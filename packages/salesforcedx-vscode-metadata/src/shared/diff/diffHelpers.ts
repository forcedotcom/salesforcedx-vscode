/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { NonEmptyComponentSet, HashableUri } from 'salesforcedx-vscode-services';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { MissingDefaultOrgError } from './diffErrors';
import { createDiffFilePair, type DiffFilePair } from './diffTypes';

export const sourceComponentToPaths = (component: SourceComponent) =>
  [component.content, component.xml, ...component.walkContent()].filter(isString);

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

/**
 * Match project SourceComponents to retrieved remote paths using ComponentSet identity.
 * Uses getComponentFilenamesByNameAndType so local directory name is irrelevant —
 * remote paths are looked up by type+fullName, not by path heuristics.
 *
 * @param localUriFilter - allowlist of local URIs to include in the result. Use when the caller already knows
 * which files the user acted on (e.g. right-click → diff on specific files) and wants to suppress pairs
 * for other files in the same component. Omit to include all files.
 */
export const matchUrisToComponents = Effect.fn('matchUrisToComponents')(function* (
  projectComponentSet: ComponentSet,
  retrievedComponentSet: ComponentSet,
  localUriFilter?: HashSet.HashSet<HashableUri>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;

  const projectComponents = projectComponentSet.getSourceComponents().toArray();

  yield* Effect.annotateCurrentSpan({
    projectComponents: projectComponents.map(c => `${c.type.name}:${c.fullName}`)
  });

  return yield* Stream.fromIterable(projectComponents).pipe(
    Stream.flatMap(projectComp => {
      // basename → remote path, built once per component pair so we never cross-match
      // between components that share filenames (e.g. two LWCs both having helper.js).
      const remotePaths = retrievedComponentSet.getComponentFilenamesByNameAndType({
        fullName: projectComp.fullName,
        type: projectComp.type.name
      });
      if (remotePaths.length === 0) return Stream.empty;
      const byBasename = new Map(remotePaths.map(p => [Utils.basename(URI.file(p)), p]));
      return Stream.fromIterable(sourceComponentToPaths(projectComp)).pipe(
        Stream.mapEffect(p => fsService.toUri(p).pipe(Effect.map(uri => fsService.HashableUri.fromUri(uri)))),
        Stream.filter(u => !localUriFilter || HashSet.has(localUriFilter, u)),
        Stream.filterMap(localUri =>
          Option.fromNullable(byBasename.get(Utils.basename(localUri))).pipe(
            Option.map(remotePath => ({ localUri, remotePath }))
          )
        ),
        Stream.mapEffect(({ localUri, remotePath }) =>
          fsService.toUri(remotePath).pipe(
            Effect.map(uri => fsService.HashableUri.fromUri(uri)),
            Effect.map(remoteUri => createDiffFilePair({ localUri, remoteUri, fileName: Utils.basename(localUri) }))
          )
        )
      );
    }),
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
