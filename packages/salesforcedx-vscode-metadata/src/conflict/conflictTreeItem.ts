/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import * as vscode from 'vscode';
import { nls } from '../messages';

type ConflictTreeItemKind = 'group' | 'conflict' | 'empty';

type ConflictTreeItemInputs =
  | { kind: 'group'; label: string; count: number }
  | { kind: 'conflict'; pair: DiffFilePair }
  | { kind: 'empty'; label: string };

export class ConflictTreeItem extends vscode.TreeItem {
  public readonly kind: ConflictTreeItemKind;
  public readonly pair?: DiffFilePair;

  constructor(inputs: ConflictTreeItemInputs) {
    const label = inputs.kind === 'conflict' ? inputs.pair.fileName : inputs.label;
    const collapsibleState =
      inputs.kind === 'group' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;

    super(label, collapsibleState);

    this.kind = inputs.kind;

    if (inputs.kind === 'conflict') {
      this.pair = inputs.pair;
      this.contextValue = 'conflict-actions';
      this.command = {
        title: nls.localize('conflict_detect_diff_command_title'),
        command: 'sf.conflict.diff',
        arguments: [inputs.pair]
      };
    }
  }
}
