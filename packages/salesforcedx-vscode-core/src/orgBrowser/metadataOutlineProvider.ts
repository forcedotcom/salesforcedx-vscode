/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { hasRootWorkspace, OrgAuthInfo } from '../util';
import { BrowserNode, ComponentUtils, NodeType, TypeUtils } from './index';

export class MetadataOutlineProvider
  implements vscode.TreeDataProvider<BrowserNode> {
  private defaultOrg: string | undefined;

  private internalOnDidChangeTreeData: vscode.EventEmitter<
    BrowserNode | undefined
  > = new vscode.EventEmitter<BrowserNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    BrowserNode | undefined
  > = this.internalOnDidChangeTreeData.event;

  constructor(defaultOrg: string | undefined) {
    this.defaultOrg = defaultOrg;
  }

  public async onViewChange() {
    const usernameOrAlias = await this.getDefaultUsernameOrAlias();
    if (usernameOrAlias !== this.defaultOrg) {
      this.internalOnDidChangeTreeData.fire();
    }
    this.defaultOrg = usernameOrAlias;
  }

  public async refresh(): Promise<void> {
    const usernameOrAlias = await this.getDefaultUsernameOrAlias();
    this.defaultOrg = usernameOrAlias;
    this.internalOnDidChangeTreeData.fire();
  }

  public getTreeItem(element: BrowserNode): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: BrowserNode): Promise<BrowserNode[]> {
    if (isNullOrUndefined(this.defaultOrg)) {
      const emptyDefault = new BrowserNode(
        nls.localize('missing_default_org'),
        NodeType.EmptyNode
      );
      return Promise.resolve([emptyDefault]);
    }

    if (isNullOrUndefined(element)) {
      const org = new BrowserNode(this.defaultOrg, NodeType.Org);
      return Promise.resolve([org]);
    }

    switch (element.type) {
      case NodeType.Org:
        element.children = await this.getTypes();
        break;
      case NodeType.MetadataType:
        element.children = await this.getComponents(element);
        break;
    }
    return Promise.resolve(element.children);
  }

  public async getTypes(): Promise<BrowserNode[]> {
    const username = this.defaultOrg!;
    const typeUtil = new TypeUtils();
    try {
      const typesList = await typeUtil.loadTypes(username);
      const nodeList = typesList.map(
        type => new BrowserNode(type, NodeType.MetadataType)
      );
      return nodeList;
    } catch (e) {
      const errorNode = new BrowserNode(parseErrors(e), NodeType.EmptyNode);
      return [errorNode];
    }
  }

  public async getComponents(
    metadataType: BrowserNode
  ): Promise<BrowserNode[]> {
    const username = this.defaultOrg!;
    const cmpUtil = new ComponentUtils();
    const componentsList = await cmpUtil.loadComponents(
      username,
      metadataType.label!
    );
    const nodeList = componentsList.map(
      cmp => new BrowserNode(cmp, NodeType.MetadataCmp, metadataType.label!)
    );
    if (nodeList.length === 0) {
      nodeList.push(
        new BrowserNode(nls.localize('empty_components'), NodeType.EmptyNode)
      );
    }
    return nodeList;
  }

  public async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    if (hasRootWorkspace()) {
      const username = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
      return username;
    } else {
      throw new Error(nls.localize('cannot_determine_workspace'));
    }
  }
}

function parseErrors(error: string): string {
  const e = JSON.parse(error);
  let message: string;
  switch (e.name) {
    case 'RefreshTokenAuthError':
      message = nls.localize('error_auth_token');
      break;
    case 'NoOrgFound':
      message = nls.localize('error_no_org_found');
      break;
    default:
      message = nls.localize('error_fetching_metadata');
      break;
  }
  message += nls.localize('error_org_browser_text');
  return message;
}
