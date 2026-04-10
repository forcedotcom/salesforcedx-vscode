/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable functional/no-let -- module-level refs set during ensureConflictView */

import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { isDiffFilePair, type DiffFilePair } from '../shared/diff/diffTypes';
import { withActiveMetadataOperation } from '../utils/withActiveMetadataOperation';
import { detectConflictsFromTracking } from './conflictDetection';
import { ConflictTreeItem } from './conflictTreeItem';
import {
  ConflictTreeProvider,
  createEmptyConflictState,
  getConflictStateRef,
  setConflictStateRef
} from './conflictTreeProvider';

export const CONFLICTS_VIEW_ID = 'conflicts';

export let conflictTreeProvider: ConflictTreeProvider;

let conflictViewContext: vscode.ExtensionContext | undefined;

export const setConflictViewContext = (context: vscode.ExtensionContext): void => {
  conflictViewContext = context;
};

export const ensureConflictView = Effect.fn('ensureConflictView')(function* () {
  if (conflictTreeProvider) return;
  const context = conflictViewContext;
  if (!context) return;
  const initialState = createEmptyConflictState();
  const ref = yield* SubscriptionRef.make(initialState);
  setConflictStateRef(ref);
  conflictTreeProvider = new ConflictTreeProvider();
  const treeView = vscode.window.createTreeView(CONFLICTS_VIEW_ID, {
    treeDataProvider: conflictTreeProvider
  });
  context.subscriptions.push(treeView);
});

export const conflictDiffCommandEffect = (entry: DiffFilePair | ConflictTreeItem) => {
  const pair = isDiffFilePair(entry) ? entry : entry?.pair;
  return pair && isDiffFilePair(pair)
    ? Effect.sync(() => {
        const title = nls.localize('conflict_detect_diff_title', 'remote', pair.fileName, pair.fileName);
        void vscode.commands.executeCommand('vscode.diff', pair.remoteUri.toUri(), pair.localUri.toUri(), title);
      })
    : Effect.void;
};

export const conflictOpenCommandEffect = (node: ConflictTreeItem) => {
  const pair = node?.pair;
  return pair ? Effect.sync(() => void vscode.window.showTextDocument(pair.localUri.toUri())) : Effect.void;
};

/** Detect conflicts, populate tree, focus view. Used when status bar clicked with conflicts. */
export const openConflictViewCommand = Effect.fn('openConflictView')(function* () {
  yield* ensureConflictView();
  const pairs = yield* withActiveMetadataOperation(detectConflictsFromTracking());
  const stateRef = getConflictStateRef();
  const title = `${pairs.length} file${pairs.length === 1 ? '' : 's'} in conflict`;
  yield* SubscriptionRef.update(stateRef, () => ({
    title,
    mode: 'conflicts' as const,
    entries: pairs,
    emptyLabel: nls.localize('conflict_detect_no_conflicts')
  }));
  conflictTreeProvider.fireChange();
  yield* Effect.sync(() => void vscode.commands.executeCommand(`${CONFLICTS_VIEW_ID}.focus`));
});
