/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { forceDescribeMetadata } from './index';

export class TypeNodeProvider implements vscode.TreeDataProvider<MetadataType> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    MetadataType | undefined
  > = new vscode.EventEmitter<MetadataType | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    MetadataType | undefined
  > = this._onDidChangeTreeData.event;

  constructor() {}

  public async refresh(): Promise<void> {
    await forceDescribeMetadata();
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: MetadataType): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: MetadataType): MetadataType[] {
    return [
      new MetadataType('hello', 1, 'meta'),
      new MetadataType('poop', 1, 'type')
    ];
  }
}

export class MetadataType extends vscode.TreeItem {
  constructor(
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public type: string,
    public command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }

  get tooltip(): string {
    return 'metadata type';
  }

  get description(): string {
    return this.type;
  }

  public contextValue = 'metadataType';
}

export class MetadataCmp extends vscode.TreeItem {
  constructor(
    public label: string,
    public type: string,
    public command?: vscode.Command
  ) {
    super(label, 0);
  }

  get tooltip(): string {
    return 'metadata component';
  }

  get description(): string {
    return this.type;
  }

  public contextValue = 'metadataComponent';
}
