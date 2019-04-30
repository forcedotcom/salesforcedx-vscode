/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { hasRootWorkspace, OrgAuthInfo } from '../util';
import { forceDescribeMetadata, Node, NodeType } from './index';

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
    // trigger refresh of type nodes
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  /* if there is not an element, load and display the default org then load the metadata types for the org
  if there is an element, this method will call ie. getComponents to load cmps for the md type  */
  public getChildren(element?: Node): Promise<Node[]> {
    if (isNullOrUndefined(element)) {
      if (!isNullOrUndefined(this.defaultOrg)) {
        // at this point the metadata types would be loaded too
        const org = new Node(this.defaultOrg, NodeType.Org, 'Type Org');
        getMetadataTypes(org);
        return Promise.resolve([org]);
      } else {
        vscode.window.showInformationMessage('No default org set');
        return Promise.resolve([]);
      }
    } else {
      // call the get component method and return the type node again
      return Promise.resolve(element.children);
    }
  }

  public async getDefaultUsernameOrAlias() {
    if (hasRootWorkspace()) {
      this.defaultOrg = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    }
  }
}

function getMetadataTypes(org: Node): Node {
  org.children = [
    new Node('type 1', NodeType.MetadataType, 'component'),
    new Node('type 2', NodeType.MetadataType, 'component'),
    new Node('type 3', NodeType.MetadataType, 'component')
  ];
  return org;
}
