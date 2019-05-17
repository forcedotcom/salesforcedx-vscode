/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { hasRootWorkspace, OrgAuthInfo } from '../util';
import {
  BrowserNode,
  buildTypesList,
  forceDescribeMetadata,
  NodeType
} from './index';
import {
  buildComponentsList,
  forceListMetadata,
  getComponentsPath
} from './metadataCmp';
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
        return Promise.resolve([org]);
      } else {
        return Promise.resolve([]);
      }
    } else if (element.type === NodeType.MetadataType) {
      const metadataCmps = await this.getComponents(element);
      element.children = metadataCmps;
      return Promise.resolve(element.children);
    } else if (element.type === NodeType.Org) {
      const metadataTypes = await this.getTypes();
      element.children = metadataTypes;
      return Promise.resolve(element.children);
    }

    return Promise.resolve([]);
  }

  public async getTypes(): Promise<BrowserNode[]> {
    const outputPath = await getTypesPath();
    if (!fs.existsSync(outputPath)) {
      await forceDescribeMetadata(outputPath);
    }
    const typesList = buildTypesList(outputPath);
    const nodeList = [];
    for (const type of typesList) {
      const typeNode = new BrowserNode(type, NodeType.MetadataType);
      nodeList.push(typeNode);
    }
    return nodeList;
  }

  public async getComponents(
    metadataType: BrowserNode
  ): Promise<BrowserNode[]> {
    const componentsPath = await getComponentsPath(
      metadataType.label!,
      this.defaultOrg!
    );
    if (!fs.existsSync(componentsPath)) {
      await forceListMetadata(metadataType.label!, this.defaultOrg!);
    }
    const componentsList = buildComponentsList(
      componentsPath,
      metadataType.label!
    );
    const nodeList = [];
    for (const cmp of componentsList) {
      const cmpNode = new BrowserNode(cmp, NodeType.MetadataCmp);
      nodeList.push(cmpNode);
    }
    return nodeList;
  }

  public async getDefaultUsernameOrAlias() {
    if (hasRootWorkspace()) {
      this.defaultOrg = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    }
  }
}
