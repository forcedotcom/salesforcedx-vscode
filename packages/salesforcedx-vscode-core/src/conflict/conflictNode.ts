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
  localRelPath: string;
  remoteRelPath: string;
  localPath: string;
  remotePath: string;
  localLastModifiedDate: string | undefined;
  remoteLastModifiedDate: string | undefined;
};

export class ConflictNode extends vscode.TreeItem {
  private _children: ConflictNode[];
  private _parent: ConflictNode | undefined;
  protected _conflict: ConflictFile | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    parent?: ConflictNode,
    description?: string | boolean
  ) {
    super(label, collapsibleState);
    this._children = [];
    this._parent = parent;
    this.description = description;
  }

  public addChildConflictNode(conflictNode: ConflictNode) {
    this._children.push(conflictNode);
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

  // TODO: create issue to track this

  // @ts-ignore
  get tooltip() {
    if (this._conflict) {
      let tooltipMessage: string = '';
      if (this._conflict.remoteLastModifiedDate) {
        tooltipMessage += nls.localize(
          'conflict_detect_remote_last_modified_date',
          `${new Date(this._conflict.remoteLastModifiedDate).toLocaleString()}`
        );
      }
      if (this._conflict.localLastModifiedDate) {
        tooltipMessage += nls.localize(
          'conflict_detect_local_last_modified_date',
          `${new Date(this._conflict.localLastModifiedDate).toLocaleString()}`
        );
      }
      return tooltipMessage;
    } else {
      return this.label;
    }
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
      command: 'sf.conflict.diff',
      arguments: [this._conflict]
    };
  }
}

export class ConflictGroupNode extends ConflictNode {
  private emptyLabel?: string;

  constructor(label: string, emptyLabel?: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.emptyLabel = emptyLabel;
  }

  public addChildren(conflicts: ConflictFile[]) {
    if (conflicts.length === 0) {
      this.children.push(new ConflictNode(this.emptyLabel || '', vscode.TreeItemCollapsibleState.None));
    }

    conflicts.forEach(entry => {
      const child = new ConflictFileNode(entry, this);
      child.attachCommands();
      this.children.push(child);
    });
  }
}
