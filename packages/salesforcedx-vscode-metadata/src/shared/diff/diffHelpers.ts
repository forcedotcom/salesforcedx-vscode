/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { HashableUri, NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { type ProgressOnlyCommandKey } from '../../utils/notificationMode';
import { MissingDefaultOrgError } from './diffErrors';
import { createDiffFilePair, type DiffFilePair } from './diffTypes';

const COMMAND: ProgressOnlyCommandKey = 'SFDX: Diff Source Against Org';

export const sourceComponentToPaths = (component: SourceComponent) =>
  [component.content, component.xml, ...component.walkContent()].filter(isString);

const getCacheDirectory = Effect.fn('getCacheDirectory')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [workspaceInfo, defaultOrgRef] = yield* Effect.all(
    [api.services.WorkspaceService.getWorkspaceInfoOrThrow(), Effect.succeed(api.services.TargetOrgRef)],
    { concurrency: 'unbounded' }
  );
  const orgId = yield* defaultOrgRef().pipe(
    Effect.flatMap(SubscriptionRef.get),
    Effect.map(orgInfo => orgInfo.orgId),
    Effect.filterOrFail(
      isNotUndefined,
      () => new MissingDefaultOrgError({ message: nls.localize('missing_default_org') })
    )
  );
  return { orgId, uri: Utils.joinPath(workspaceInfo.uri, '.sf', 'orgs', orgId, 'remoteMetadata') };
});

const retrieveToCacheDirectory = Effect.fn('retrieveToCacheDirectory')(function* (componentSet: NonEmptyComponentSet) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.services.NotificationModeService;
  const cache = yield* getCacheDirectory();

  yield* api.services.FsService.safeDelete(cache.uri, { recursive: true });

  return yield* api.services.MetadataRetrieveService.retrieveComponentSetToDirectory(componentSet, cache.uri, {
    progressLocation: yield* notificationMode.getProgressLocation(COMMAND),
    expectedOrgId: cache.orgId
  });
});

/**
 * Retrieve remote source into metadata's diff cache and match it to project files.
 *
 * @param localUriFilter - allowlist of local URIs to include in the result. Use when the caller already knows
 * which files the user acted on (e.g. right-click → diff on specific files) and wants to suppress pairs
 * for other files in the same component. Omit to include all files.
 * @param componentFilter - optional predicate applied before remote materialization. Use when the caller has
 * already narrowed candidate components through catalog metadata such as remote timestamps.
 */
export const materializeRemoteComponents = Effect.fn('materializeRemoteComponents')(function* (
  projectComponentSet: ComponentSet,
  localUriFilter?: HashSet.HashSet<HashableUri>,
  componentFilter?: (component: SourceComponent) => boolean
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const allProjectComponents = projectComponentSet.getSourceComponents().toArray();
  const projectComponents = componentFilter ? allProjectComponents.filter(componentFilter) : allProjectComponents;

  yield* Effect.annotateCurrentSpan({
    projectComponentCount: allProjectComponents.length,
    selectedProjectComponentCount: projectComponents.length,
    projectComponents: projectComponents.map(c => `${c.type.name}:${c.fullName}`)
  });

  if (projectComponents.length === 0) return HashSet.empty<DiffFilePair>();
  const remoteComponentSet = yield* api.services.MetadataRetrieveService.buildComponentSet(
    projectComponents.map(component => ({ type: component.type.name, fullName: component.fullName }))
  );
  const nonEmptyRemoteComponentSet =
    yield* api.services.ComponentSetService.ensureNonEmptyComponentSet(remoteComponentSet);
  const retrieved = yield* retrieveToCacheDirectory(nonEmptyRemoteComponentSet);

  return yield* matchUrisToComponents(projectComponentSet, retrieved.components, localUriFilter, componentFilter);
});

export const matchUrisToComponents = Effect.fn('matchUrisToComponents')(function* (
  projectComponentSet: ComponentSet,
  retrievedComponentSet: ComponentSet,
  localUriFilter?: HashSet.HashSet<HashableUri>,
  componentFilter?: (component: SourceComponent) => boolean
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const allProjectComponents = projectComponentSet.getSourceComponents().toArray();
  const projectComponents = componentFilter ? allProjectComponents.filter(componentFilter) : allProjectComponents;

  return yield* Stream.fromIterable(projectComponents).pipe(
    Stream.flatMap(projectComp => {
      const remotePaths = retrievedComponentSet.getComponentFilenamesByNameAndType({
        type: projectComp.type.name,
        fullName: projectComp.fullName
      });
      if (remotePaths.length === 0) return Stream.empty;
      // basename → remote path, built once per component pair so we never cross-match
      // between components that share filenames (e.g. two LWCs both having helper.js).
      const byBasename = new Map(remotePaths.map(path => [Utils.basename(URI.file(path)), path]));
      return Stream.fromIterable(sourceComponentToPaths(projectComp)).pipe(
        Stream.mapEffect(p =>
          fsService.toUri(p).pipe(
            Effect.map(uri => ({
              localUri: fsService.HashableUri.fromUri(uri)
            }))
          )
        ),
        Stream.filter(({ localUri }) => !localUriFilter || HashSet.has(localUriFilter, localUri)),
        Stream.filterMap(({ localUri }) =>
          Option.fromNullable(byBasename.get(Utils.basename(localUri.uri))).pipe(
            Option.map(remotePath => ({ localUri, remotePath }))
          )
        ),
        Stream.mapEffect(({ localUri, remotePath }) =>
          fsService.toUri(remotePath).pipe(
            Effect.map(remoteUri =>
              createDiffFilePair({
                localUri,
                remoteUri: fsService.HashableUri.fromUri(remoteUri),
                fileName: Utils.basename(localUri.uri)
              })
            )
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
    [api.services.FsService.readFile(pair.remoteUri.uri), api.services.FsService.readFile(pair.localUri.uri)],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.tapError(e => Effect.logWarning('filesAreNotIdentical: readFile failed, skipping pair', e)),
    Effect.orElseSucceed(() => ['', ''] as const)
    // normalize whitespace
  )).map((s: string) => s.replaceAll(/\s+/g, ''));
  return buffer1 !== buffer2;
});
