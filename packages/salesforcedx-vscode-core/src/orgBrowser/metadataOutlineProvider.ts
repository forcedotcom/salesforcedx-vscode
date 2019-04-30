/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { hasRootWorkspace, OrgAuthInfo } from '../util';
import { Node, NodeType } from './index';

export class TypeNodeProvider implements vscode.TreeDataProvider<Node> {
  private defaultOrg: string | undefined;

  private _onDidChangeTreeData: vscode.EventEmitter<
    Node | undefined
  > = new vscode.EventEmitter<Node | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<Node | undefined> = this
    ._onDidChangeTreeData.event;

  constructor() {}

  public async refresh(): Promise<void> {
    await this.getDefaultUsernameOrAlias();
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: Node): Promise<Node[]> {
    if (isNullOrUndefined(element)) {
      if (!isNullOrUndefined(this.defaultOrg)) {
        const org = new Node(this.defaultOrg, NodeType.Org);
        return Promise.resolve([org]);
      } else {
        return Promise.resolve([]);
      }
    } else {
      return Promise.resolve(element.children);
    }
  }

  public async getDefaultUsernameOrAlias() {
    if (hasRootWorkspace()) {
      this.defaultOrg = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    }
  }
}
