/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../messages';

export type ConflictFile = {
  remoteLabel: string;
  fileName: string;
  relPath: string;
  localPath: string;
  remotePath: string;
};

export class ConflictNode extends vscode.TreeItem {
  private _children: ConflictNode[];
  private _parent: ConflictNode | undefined;
  protected _conflict: ConflictFile | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    parent?: ConflictNode
  ) {
    super(label, collapsibleState);
    this._children = [];
    this._parent = parent;
  }

  get conflict() {
    return this._conflict;
  }

  get parent() {
    return this._parent;
  }

  get children() {
    return this._children;
  }

  get tooltip() {
    return this._conflict ? this._conflict.relPath : this.label;
  }
}

export class ConflictFileNode extends ConflictNode {
  constructor(conflict: ConflictFile, parent: ConflictNode) {
    super(conflict.fileName, vscode.TreeItemCollapsibleState.None, parent);
    this._conflict = conflict;
  }

  public attachCommands() {
    this.contextValue = 'conflict-actions';
    this.command = {
      title: nls.localize('conflict_detect_diff_command_title'),
      command: 'sfdx.force.conflict.diff',
      arguments: [this._conflict]
    };
  }
}

export class ConflictGroupNode extends ConflictNode {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
  }

  public addChildren(conflicts: ConflictFile[]) {
    if (conflicts.length === 0) {
      this.children.push(
        new ConflictNode(
          nls.localize('conflict_detect_no_conflicts'),
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    conflicts.forEach(entry => {
      const child = new ConflictFileNode(entry, this);
      child.attachCommands();
      this.children!.push(child);
    });
  }
}
