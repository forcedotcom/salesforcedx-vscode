/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { NonEmptyComponentSet, HashableUri } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { filesAreNotIdentical, materializeRemoteComponents } from './diffHelpers';

/** Diff ComponentSet - retrieve to cache and show diffs. Returns pairs that were diffed (non-identical). */
export const diffComponentSet = Effect.fn('diffComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
  localUriFilter: HashSet.HashSet<HashableUri>;
}) {
  const { componentSet, localUriFilter } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.v2.services.ChannelService;

  yield* channelService.appendToChannel(
    `Retrieving ${componentSet.size} component${componentSet.size === 1 ? '' : 's'} for diff...`
  );

  const pairsSet = yield* materializeRemoteComponents(componentSet, localUriFilter);

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
