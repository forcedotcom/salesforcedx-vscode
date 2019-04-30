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
  MetadataCmp
}

export class Node extends vscode.TreeItem {
  public children: Node[] = [];
  constructor(label: string, public readonly type: NodeType) {
    super(label);
    this.type = type;
    switch (this.type) {
      case NodeType.Org:
        this.collapsibleState = 1;
        this.tooltip = 'Default Org';
        break;
      case NodeType.MetadataCmp:
        this.collapsibleState = 0;
        this.tooltip = 'Metadata Component';
        break;
      case NodeType.MetadataType:
        this.collapsibleState = 1;
        this.tooltip = 'Metadata Type';
        break;
    }
  }
}
