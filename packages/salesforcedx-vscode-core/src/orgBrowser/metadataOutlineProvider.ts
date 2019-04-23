/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { hasRootWorkspace, OrgAuthInfo } from '../util';
import { forceDescribeMetadata } from './index';

export class TypeNodeProvider implements vscode.TreeDataProvider<Org> {
  private defaultOrg: string | undefined;

  private _onDidChangeTreeData: vscode.EventEmitter<
    MetadataType | undefined
  > = new vscode.EventEmitter<MetadataType | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    MetadataType | undefined
  > = this._onDidChangeTreeData.event;

  constructor() {
    this.getDefaultUsernameOrAlias().catch(err => {
      throw new Error(err);
    });
  }

  public async refresh(): Promise<void> {
    await forceDescribeMetadata();
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: MetadataType): vscode.TreeItem {
    return element;
  }

  /*   if there is an element, this method will call ie. getComponents to load cmps for the md type
else, call forceDescribeMetadata to load metadata type nodes  */
  public getChildren(element?: MetadataType): Promise<Org[]> {
    if (isNullOrUndefined(element)) {
      if (!isNullOrUndefined(this.defaultOrg)) {
        return Promise.resolve([new Org(this.defaultOrg, 1, 'meta')]);
      } else {
        vscode.window.showInformationMessage('No default org set');
        return Promise.resolve([]);
      }
    }
    return Promise.resolve([new Org('Example', 1, 'meta')]);
  }

  public async getDefaultUsernameOrAlias() {
    if (hasRootWorkspace()) {
      this.defaultOrg = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    }
  }
}

export class Org extends vscode.TreeItem {
  constructor(
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public type: string,
    public command?: vscode.Command
  ) {
    super(label, 1);
  }

  get tooltip(): string {
    return 'Default Org';
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
    return 'Metadata Type';
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
    return 'Metadata Component';
  }

  get description(): string {
    return this.type;
  }

  public contextValue = 'metadataComponent';
}
