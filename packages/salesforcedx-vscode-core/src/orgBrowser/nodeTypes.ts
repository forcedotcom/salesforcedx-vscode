/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export enum NodeType {
  Org,
  MetadataType,
  MetadataCmp,
  EmptyNode,
  Folder
}

export class BrowserNode extends vscode.TreeItem {
  public children: BrowserNode[] = [];
  public readonly fullName: string;
  constructor(
    label: string,
    public readonly type: NodeType,
    fullName?: string
  ) {
    super(label);
    this.type = type;
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
}
