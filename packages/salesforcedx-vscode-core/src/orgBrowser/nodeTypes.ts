/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../messages';

export enum NodeType {
  Org = 'org',
  MetadataType = 'type',
  MetadataCmp = 'component',
  EmptyNode = 'empty',
  Folder = 'folder'
}

export class BrowserNode extends vscode.TreeItem {
  public toRefresh: boolean = false;
  public readonly fullName: string;
  private _children: BrowserNode[] | undefined;
  private _parent: BrowserNode | undefined;

  constructor(
    label: string,
    public readonly type: NodeType,
    fullName?: string
  ) {
    super(label);
    this.type = type;
    this.contextValue = type;
    this.fullName = fullName || label;
    switch (this.type) {
      case NodeType.Org:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        break;
      case NodeType.MetadataCmp:
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.iconPath = vscode.ThemeIcon.File;
        break;
      case NodeType.MetadataType:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        break;
      case NodeType.Folder:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        this.iconPath = vscode.ThemeIcon.Folder;
        break;
      case NodeType.EmptyNode:
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        break;
    }
  }

  public setChildren(fullNames: string[], type: NodeType) {
    this._children = [];
    if (fullNames.length === 0) {
      this._children.push(
        new BrowserNode(nls.localize('empty_components'), NodeType.EmptyNode)
      );
    }
    fullNames.forEach(fullName => {
      const label =
        this.type === NodeType.Folder
          ? fullName.substr(fullName.indexOf('/') + 1)
          : fullName;
      const child = new BrowserNode(label, type, fullName);
      child._parent = this;
      this._children!.push(child);
    });
  }

  get parent() {
    return this._parent;
  }

  get children() {
    return this._children;
  }
}
