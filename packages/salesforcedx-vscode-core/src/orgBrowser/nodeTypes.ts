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
  EmptyNode
}

export class BrowserNode extends vscode.TreeItem {
  public children: BrowserNode[] = [];
  constructor(label: string, public readonly type: NodeType) {
    super(label);
    this.type = type;
    switch (this.type) {
      case NodeType.Org:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        this.tooltip = 'Default Org';
        break;
      case NodeType.MetadataCmp:
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.tooltip = 'Metadata Component';
        break;
      case NodeType.MetadataType:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        this.tooltip = 'Metadata Type';
        break;
      case NodeType.EmptyNode:
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        break;
    }
  }
}
