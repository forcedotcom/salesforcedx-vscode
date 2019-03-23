/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { paramCase } from 'change-case';
import { Command, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';

import * as path from 'path';
export enum NodeType {
  Namespace,
  Component,
  WebComponent,
  Attribute
}
function getLabel(label: string, type: NodeType) {
  if (type === NodeType.WebComponent) {
    const [ns, ...rest] = label.split(':');
    return ns + '-' + paramCase(rest.join(''));
  }
  return label;
}
export class LwcNode extends TreeItem {
  public children: LwcNode[] = [];
  constructor(
    label: string,
    public readonly tooltip: string,
    public readonly type: NodeType,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly uri?: Uri,
    public readonly command?: Command
  ) {
    super(getLabel(label, type), collapsibleState);
    this.tooltip = tooltip;
    this.type = type;
  }

  get contextValue() {
    if (
      (this.type === NodeType.Component ||
        this.type === NodeType.WebComponent) &&
      !this.uri
    ) {
      return 'external';
    }
    return undefined;
  }

  get iconPath() {
    let retVal = null;
    if (this.type === NodeType.Namespace) {
      retVal = 'namespace.svg';
    } else if (this.type === NodeType.Attribute) {
      retVal = 'attribute.svg';
    } else if (this.type === NodeType.WebComponent) {
      retVal = 'lwclogo.png';
    } else {
      retVal = 'lightning-file.svg';
    }
    return path.join(__dirname, '..', '..', '..', 'resources', retVal);
  }
}
