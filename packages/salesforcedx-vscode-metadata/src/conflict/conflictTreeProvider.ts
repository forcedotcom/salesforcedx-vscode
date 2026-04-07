/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getMetadataRuntime } from '../services/extensionProvider';
import { ConflictTreeItem } from './conflictTreeItem';

export type ConflictTreeState = {
  title?: string;
  mode: 'conflicts' | 'diffs';
  entries: DiffFilePair[];
  emptyLabel?: string;
};

const EMPTY_STATE: ConflictTreeState = {
  mode: 'conflicts',
  entries: []
};

const stateRefHolder: { ref?: SubscriptionRef.SubscriptionRef<ConflictTreeState> } = {};
export const setConflictStateRef = (ref: SubscriptionRef.SubscriptionRef<ConflictTreeState>): void => {
  stateRefHolder.ref = ref;
};
export const getConflictStateRef = (): SubscriptionRef.SubscriptionRef<ConflictTreeState> =>
  stateRefHolder.ref!;

const getChildrenFromState = async (element?: ConflictTreeItem): Promise<ConflictTreeItem[]> => {
  const state = await getMetadataRuntime().runPromise(SubscriptionRef.get(getConflictStateRef()));
  if (!element) {
    if (state.entries.length === 0 && !state.title) {
      return [];
    }
    const rootLabel = state.title ?? state.emptyLabel;
    const count = state.entries.length;
    return [new ConflictTreeItem({ kind: 'group', label: rootLabel ?? nls.localize('conflict_detect_no_conflicts'), count })];
  }

  if (element.kind === 'group') {
    return state.entries.length === 0
      ? [new ConflictTreeItem({ kind: 'empty', label: state.emptyLabel ?? nls.localize('conflict_detect_no_conflicts') })]
      : state.entries.map(pair => new ConflictTreeItem({ kind: 'conflict', pair }));
  }

  return [];
};

export class ConflictTreeProvider implements vscode.TreeDataProvider<ConflictTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ConflictTreeItem | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /* eslint-disable-next-line class-methods-use-this -- TreeDataProvider.getTreeItem returns element */
  public getTreeItem(element: ConflictTreeItem): vscode.TreeItem {
    return element;
  }

  /* eslint-disable-next-line class-methods-use-this -- TreeDataProvider.getTreeItem returns element */
  public async getChildren(element?: ConflictTreeItem): Promise<ConflictTreeItem[]> {
    return getChildrenFromState(element);
  }

  public fireChange(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

export const createEmptyConflictState = (): ConflictTreeState => ({ ...EMPTY_STATE });
