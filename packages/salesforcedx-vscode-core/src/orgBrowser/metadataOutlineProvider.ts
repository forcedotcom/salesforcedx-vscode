/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { hasRootWorkspace, OrgAuthInfo } from '../util';
import {
  BrowserNode,
  buildTypesList,
  forceDescribeMetadata,
  NodeType
} from './index';
import { getTypesPath } from './metadataType';

export class MetadataOutlineProvider
  implements vscode.TreeDataProvider<BrowserNode> {
  private defaultOrg: string | undefined;

  private internalOnDidChangeTreeData: vscode.EventEmitter<
    BrowserNode | undefined
  > = new vscode.EventEmitter<BrowserNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    BrowserNode | undefined
  > = this.internalOnDidChangeTreeData.event;

  constructor(defaultOrg?: string) {
    this.defaultOrg = defaultOrg;
  }

  public async refresh(defaultOrg?: string): Promise<void> {
    if (!isNullOrUndefined(defaultOrg)) {
      this.defaultOrg = defaultOrg;
    }
    this.internalOnDidChangeTreeData.fire();
  }

  public getTreeItem(element: BrowserNode): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: BrowserNode): Promise<BrowserNode[]> {
    if (isNullOrUndefined(element)) {
      if (!isNullOrUndefined(this.defaultOrg)) {
        const org = new BrowserNode(this.defaultOrg, NodeType.Org);
        const metadataTypes = await this.getTypes();
        org.children = metadataTypes;
        return Promise.resolve([org]);
      } else {
        return Promise.resolve([]);
      }
    } else {
      return Promise.resolve(element.children);
    }
  }

  public async getTypes(): Promise<BrowserNode[]> {
    await forceDescribeMetadata();
    const outputPath = await getTypesPath();
    const typesList = buildTypesList(outputPath!);
    const nodeList = [];
    for (const type of typesList) {
      const typeNode = new BrowserNode(type, NodeType.MetadataType);
      nodeList.push(typeNode);
    }
    return nodeList;
  }

  public async getDefaultUsernameOrAlias() {
    if (hasRootWorkspace()) {
      this.defaultOrg = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    }
  }
}
