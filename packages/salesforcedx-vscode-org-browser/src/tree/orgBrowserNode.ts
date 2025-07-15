/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export type OrgBrowserNodeKind = 'type' | 'folder' | 'component';

export class OrgBrowserNode extends vscode.TreeItem {
  constructor(
    public readonly kind: OrgBrowserNodeKind,
    public readonly xmlName: string,
    public readonly folderName?: string,
    public readonly componentName?: string
  ) {
    super(
      kind === 'type' ? xmlName : kind === 'folder' ? folderName! : componentName!,
      kind === 'component' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.contextValue = kind;
    this.id =
      kind === 'type'
        ? xmlName
        : kind === 'folder'
          ? `${xmlName}:${folderName}`
          : folderName
            ? `${xmlName}:${folderName}:${componentName}`
            : `${xmlName}:${componentName}`;
  }
}
