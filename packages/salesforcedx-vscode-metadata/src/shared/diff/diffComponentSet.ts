/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from './diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Stream from 'effect/Stream';
import type { NonEmptyComponentSet, HashableUri } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { formatRetrieveOutput } from '../retrieve/formatRetrieveOutput';
import { VscodeDiffError } from './diffErrors';
import { filesAreNotIdentical, matchUrisToComponents, retrieveToCacheDirectory } from './diffHelpers';

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
          catch: err =>
            new VscodeDiffError({
              message: err instanceof Error ? err.message : String(err),
              cause: err
            })
        }).pipe(
          Effect.catchAll(err => {
            const errorMessage = err.message;
            return Effect.gen(function* () {
              yield* channelService.appendToChannel(`Diff failed for ${pair.fileName}: ${errorMessage}`);
              yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
              yield* Effect.sync(() => {
                void vscode.window.showErrorMessage(
                  nls.localize('source_diff_failed_for_file', pair.fileName, errorMessage)
                );
              });
            });
          })
        )
      )
    )
    .pipe(Stream.runCollect);
});

/** Diff ComponentSet - retrieve to cache and show diffs. Returns pairs that were diffed (non-identical). */
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
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('source_diff_cancelled'));
    });
    return [];
  }

  yield* channelService.appendToChannel(yield* formatRetrieveOutput(retrieveResult));

  const retrievedComponents = retrieveResult.components.getSourceComponents().toArray();
  if (retrievedComponents.length === 0) {
    yield* channelService.appendToChannel('No components retrieved from org');
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('source_diff_no_results'));
    });
    return [];
  }

  // Match URIs to components
  const pairsSet = yield* matchUrisToComponents(initialUris, retrievedComponents);

  if (HashSet.size(pairsSet) === 0) {
    yield* channelService.appendToChannel('No matching files found to diff');
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('source_diff_no_matching_files'));
    });
    return [];
  }

  // Execute diffs
  const diffsOpen = yield* executeDiff(pairsSet);
  if (diffsOpen.length === 0) {
    yield* Effect.sync(() => {
      void vscode.window.showInformationMessage(nls.localize('source_diff_all_files_match'));
    });
  }
  yield* channelService.appendToChannel(
    `Diff completed for ${HashSet.size(pairsSet)} file${HashSet.size(pairsSet) === 1 ? '' : 's'}`
  );
  return Chunk.toArray(diffsOpen);
});
