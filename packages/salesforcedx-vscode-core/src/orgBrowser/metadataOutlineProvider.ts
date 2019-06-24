/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
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
import { getTypesFolder } from './metadataType';

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

  public async onViewChange() {
    if (await this.getDefaultUsernameOrAlias()) {
      this.internalOnDidChangeTreeData.fire();
    }
  }

  public async refresh(defaultOrg?: string): Promise<void> {
    await this.getDefaultUsernameOrAlias();
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
        const emptyDefault = new BrowserNode(
          'No default org set',
          NodeType.EmptyNode
        );
        return Promise.resolve([emptyDefault]);
      }
    } else if (element.type === NodeType.Org) {
      const metadataTypes = await this.getTypes();
      element.children = metadataTypes;
      return Promise.resolve(element.children);
    } else if (element.type === NodeType.MetadataType) {
      const metadataCmps = await this.getComponents(element);
      if (isNullOrUndefined(metadataCmps) || metadataCmps.length === 0) {
        const emptyDefault = new BrowserNode(
          'No components available',
          NodeType.EmptyNode
        );
        element.children = [emptyDefault];
      } else {
        element.children = metadataCmps;
      }
      return Promise.resolve(element.children);
    }

    return Promise.resolve([]);
  }

  public async getTypes(): Promise<BrowserNode[]> {
    const username = this.defaultOrg!;
    const typesFolder = await getTypesFolder(username);
    const typesPath = path.join(typesFolder, 'metadataTypes.json');

    let typesList: string[];
    if (!fs.existsSync(typesPath)) {
      try {
        const result = await forceDescribeMetadata(typesFolder);
        typesList = buildTypesList(result, undefined);
      } catch (e) {
        const errorNode = new BrowserNode(parseErrors(e), NodeType.EmptyNode);
        return [errorNode];
      }
    } else {
      typesList = buildTypesList(undefined, typesPath);
    }
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
    const username = this.defaultOrg!;
    const componentsPath = await getComponentsPath(
      metadataType.label!,
      username
    );

    let componentsList: string[];
    if (!fs.existsSync(componentsPath)) {
      const result = await forceListMetadata(
        metadataType.label!,
        username,
        componentsPath
      );
      componentsList = buildComponentsList(
        metadataType.label!,
        result,
        undefined
      );
    } else {
      componentsList = buildComponentsList(
        metadataType.label!,
        undefined,
        componentsPath
      );
    }
    const nodeList = [];
    for (const component of componentsList) {
      const cmpNode = new BrowserNode(component, NodeType.MetadataCmp);
      nodeList.push(cmpNode);
    }
    return nodeList;
  }

  public async getDefaultUsernameOrAlias(): Promise<boolean> {
    if (hasRootWorkspace()) {
      const username = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
      let diff = false;
      if (username !== this.defaultOrg) {
        diff = true;
      }
      this.defaultOrg = username;
      return diff;
    } else {
      throw new Error('Workspace could not be found.');
    }
  }
}

export function parseErrors(error: string): string {
  const e = JSON.parse(error);
  let message: string;
  switch (e.name) {
    case 'RefreshTokenAuthError':
      message = 'Error refreshing authentication token.';
      break;
    case 'NoOrgFound':
      message = 'No org authorization info found.';
      break;
    default:
      message = 'Error fetching metadata for org.';
      break;
  }
  message += ' Run "SFDX: Authorize an Org" to authorize your org again.';
  return message;
}
