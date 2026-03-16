/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ConflictTreeState } from './conflictTreeProvider';
import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';

export type ConflictModalResult = 'continue' | 'cancel';

export type HandleConflictsModalOptions = {
  pairs: DiffFilePair[];
  mode: 'conflicts' | 'diffs';
  stateRef: SubscriptionRef.SubscriptionRef<ConflictTreeState>;
  treeProviderFire: () => void;
  warningMessage: string;
  viewConflictsText: string;
  overrideText: string;
  emptyLabel: string;
};

const formatTitle = (count: number) => `${count} file difference${count === 1 ? '' : 's'}`;

/**
 * Show conflict modal, populate or clear tree based on user choice.
 * Returns 'continue' if user chose Override, 'cancel' if View Conflicts or dismissed.
 */
export const handleConflictsModal = Effect.fn('handleConflictsModal')(function* (options: HandleConflictsModalOptions) {
  const { pairs, mode, stateRef, treeProviderFire, warningMessage, viewConflictsText, overrideText, emptyLabel } =
    options;

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  yield* channelService.appendToChannel(
    `Conflicts: Found ${pairs.length} file${pairs.length === 1 ? '' : 's'} in conflict`
  );

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(warningMessage, { modal: true }, viewConflictsText, overrideText)
  );

  const title = formatTitle(pairs.length);

  if (choice === overrideText) {
    yield* SubscriptionRef.update(stateRef, () => ({
      title,
      mode,
      entries: [],
      emptyLabel
    }));
    treeProviderFire();
    return 'continue' satisfies ConflictModalResult;
  }

  yield* SubscriptionRef.update(stateRef, () => ({
    title,
    mode,
    entries: pairs,
    emptyLabel
  }));
  treeProviderFire();
  return 'cancel' satisfies ConflictModalResult;
});
