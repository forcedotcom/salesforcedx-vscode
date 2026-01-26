/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { NonEmptyComponentSet, HashableUri } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { ExtensionProviderService } from '../../services/extensionProvider';
import { formatRetrieveOutput } from '../retrieve/formatRetrieveOutput';

const createDiffFilePair = (props: { localUri: HashableUri; remoteUri: HashableUri; fileName: string }) =>
  Data.struct(props);

type DiffFilePair = ReturnType<typeof createDiffFilePair>;

/** Get cache directory URI for retrieved metadata */
const getCacheDirectoryUri = Effect.fn('getCacheDirectoryUri')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [workspaceService, defaultOrgRef] = yield* Effect.all(
    [api.services.WorkspaceService, Effect.succeed(api.services.TargetOrgRef)],
    { concurrency: 'unbounded' }
  );

  const workspaceInfo = yield* workspaceService.getWorkspaceInfoOrThrow;
  const orgId = (yield* SubscriptionRef.get(yield* defaultOrgRef())).orgId;

  if (!orgId) {
    return yield* Effect.fail(new Error(nls.localize('missing_default_org')));
  }

  return Utils.joinPath(workspaceInfo.uri, '.sf', 'orgs', orgId, 'remoteMetadata');
});

/** Retrieve ComponentSet to cache directory */
const retrieveToCacheDirectory = Effect.fn('retrieveToCacheDirectory')(function* (componentSet: NonEmptyComponentSet) {
  yield* Effect.logDebug('before retrieveToCacheDirectory');
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [cacheDirUri, fsService, retrieveService] = yield* Effect.all(
    [getCacheDirectoryUri(), api.services.FsService, api.services.MetadataRetrieveService],
    { concurrency: 'unbounded' }
  );

  // Clean up cache directory before retrieving
  yield* fsService.safeDelete(cacheDirUri, { recursive: true });

  // Perform retrieve operation to cache directory
  const result = yield* retrieveService.retrieveComponentSetToDirectory(componentSet, cacheDirUri);

  // Handle cancellation
  if (typeof result === 'string') {
    return undefined; // Cancelled
  }

  return result;
});

/** Match initial URIs to retrieved component file paths */
const matchUrisToComponents = (initialUris: HashSet.HashSet<HashableUri>, retrievedComponents: SourceComponent[]) =>
  Effect.gen(function* () {
    const allRemotePaths = Array.from(
      new Set<string>(
        retrievedComponents
          .flatMap(component => [component.content ?? [], component.xml ?? [], ...component.walkContent()])
          .filter(isString)
      )
    );

    // Create pairs, deduplicating by localUri to ensure each file is diffed only once
    const pairsByLocalUri = (yield* Effect.all(
      initialUris
        .pipe(
          HashSet.map(initialUri => ({ initialUri, fileName: Utils.basename(initialUri) })),
          HashSet.filter(i => isNotUndefined(i.fileName)),
          HashSet.toValues
        )
        .map(v => createMatchedPair({ allRemotePaths, initialUri: v.initialUri, fileName: v.fileName }), {
          concurrency: 'unbounded'
        })
    )).filter(isNotUndefined);

    return HashSet.fromIterable(pairsByLocalUri);
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
        remoteUri: yield* fsService.toUri(matchingPath).pipe(Effect.map(uri => fsService.HashableUri.fromUri(uri))),
        fileName
      })
    : yield* Effect.succeed(undefined);
});

const filesAreNotIdentical = (pair: DiffFilePair) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fsService = yield* api.services.FsService;
    const [buffer1, buffer2] = yield* Effect.all(
      [fsService.readFile(pair.remoteUri), fsService.readFile(pair.localUri)],
      {
        concurrency: 'unbounded'
      }
    );
    return yield* Effect.succeed(buffer1 !== buffer2);
  }).pipe(Effect.withSpan('filesAreIdentical', { attributes: { fileName: pair.fileName } }));

/** Execute vscode.diff for matched file pairs.  Returns a hash set of the files that did not match */
const executeDiff = Effect.fn('executeDiff')(function* (pairs: HashSet.HashSet<DiffFilePair>) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  return yield* pairs
    .pipe(
      Stream.fromIterable,
      Stream.filterEffect(filesAreNotIdentical),
      Stream.tap(pair =>
        Effect.tryPromise({
          try: () =>
            vscode.commands.executeCommand(
              'vscode.diff',
              pair.remoteUri,
              pair.localUri,
              nls.localize('source_diff_title', 'remote', pair.fileName, pair.fileName),
              { viewColumn: vscode.ViewColumn.Beside }
            ),
          catch: err => (err instanceof Error ? err : new Error(String(err)))
        }).pipe(
          Effect.catchAll(err => {
            const errorMessage = err.message;
            return Effect.gen(function* () {
              yield* channelService.appendToChannel(`Diff failed for ${pair.fileName}: ${errorMessage}`);
              yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
              yield* Effect.promise(() =>
                vscode.window.showErrorMessage(nls.localize('source_diff_failed_for_file', pair.fileName, errorMessage))
              );
            });
          })
        )
      )
    )
    .pipe(Stream.runCollect);
});

/** Diff ComponentSet - retrieve to cache and show diffs */
export const diffComponentSet = Effect.fn('diffComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
  initialUris: HashSet.HashSet<HashableUri>;
}) {
  const { componentSet, initialUris } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  yield* channelService.appendToChannel(
    `Retrieving ${componentSet.size} component${componentSet.size === 1 ? '' : 's'} for diff...`
  );

  const retrieveResult = yield* retrieveToCacheDirectory(componentSet);

  if (!retrieveResult) {
    yield* channelService.appendToChannel('Diff cancelled by user');
    yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('source_diff_cancelled')));
    return;
  }

  yield* channelService.appendToChannel(yield* formatRetrieveOutput(retrieveResult));

  const retrievedComponents = retrieveResult.components.getSourceComponents().toArray();
  if (retrievedComponents.length === 0) {
    yield* channelService.appendToChannel('No components retrieved from org');
    yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('source_diff_no_results')));
    return;
  }

  // Match URIs to components
  const pairsSet = yield* matchUrisToComponents(initialUris, retrievedComponents);

  if (HashSet.size(pairsSet) === 0) {
    yield* channelService.appendToChannel('No matching files found to diff');
    yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('source_diff_no_matching_files')));
    return;
  }

  // Execute diffs
  const diffsOpen = yield* executeDiff(pairsSet);
  if (diffsOpen.length === 0) {
    yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('source_diff_no_matching_files')));
  }
  yield* channelService.appendToChannel(
    `Diff completed for ${HashSet.size(pairsSet)} file${HashSet.size(pairsSet) === 1 ? '' : 's'}`
  );
});
