/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Stream from 'effect/Stream';
import type { NonEmptyComponentSet, HashableUri } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { formatRetrieveOutput } from '../retrieve/formatRetrieveOutput';
import { filesAreNotIdentical, matchUrisToComponents, retrieveToCacheDirectory } from './diffHelpers';

/** Diff ComponentSet - retrieve to cache and show diffs. Returns pairs that were diffed (non-identical). */
export const diffComponentSet = Effect.fn('diffComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
  localUriFilter: HashSet.HashSet<HashableUri>;
}) {
  const { componentSet, localUriFilter } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  yield* channelService.appendToChannel(
    `Retrieving ${componentSet.size} component${componentSet.size === 1 ? '' : 's'} for diff...`
  );

  const retrieveResult = yield* retrieveToCacheDirectory(componentSet);

  if (!retrieveResult) {
    return yield* new api.services.UserCancellationError();
  }

  yield* channelService.appendToChannel(yield* formatRetrieveOutput(retrieveResult));

  if (retrieveResult.components.getSourceComponents().toArray().length === 0) {
    yield* channelService.appendToChannel('No components retrieved from org');
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('source_diff_no_results'));
    });
    return [];
  }

  // Match URIs to components using ComponentSet identity — local dir name is irrelevant
  const pairsSet = yield* matchUrisToComponents(componentSet, retrieveResult.components, localUriFilter);

  if (HashSet.size(pairsSet) === 0) {
    yield* channelService.appendToChannel('No matching files found to diff');
    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('source_diff_no_matching_files'));
    });
    return [];
  }

  const diffsOpen = yield* Stream.fromIterable(pairsSet).pipe(
    Stream.filterEffect(filesAreNotIdentical),
    Stream.runCollect,
    Effect.map(Chunk.toArray),
    Effect.tap(arr =>
      arr.length === 0
        ? Effect.sync(() => {
            void vscode.window.showInformationMessage(nls.localize('source_diff_all_files_match'));
          })
        : Effect.void
    )
  );
  yield* channelService.appendToChannel(
    `Diff completed for ${HashSet.size(pairsSet)} file${HashSet.size(pairsSet) === 1 ? '' : 's'}`
  );
  return diffsOpen;
});
