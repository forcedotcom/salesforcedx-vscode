/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extractJsonObject, isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgAuthInfo, workspaceUtils } from '../util';
import { BrowserNode, ComponentUtils, CUSTOMOBJECTS_FULLNAME, MetadataObject, NodeType, TypeUtils } from './index';

export class MetadataOutlineProvider implements vscode.TreeDataProvider<BrowserNode> {
  private defaultOrg: string | undefined;
  private toRefresh: boolean = false;

  private internalOnDidChangeTreeData: vscode.EventEmitter<BrowserNode | undefined> = new vscode.EventEmitter<
    BrowserNode | undefined
  >();
  public readonly onDidChangeTreeData: vscode.Event<BrowserNode | undefined> = this.internalOnDidChangeTreeData.event;

  constructor(defaultOrg: string | undefined) {
    this.defaultOrg = defaultOrg;
  }

  public async onViewChange() {
    const usernameOrAlias = await this.getTargetOrgOrAlias();
    if (usernameOrAlias !== this.defaultOrg) {
      this.internalOnDidChangeTreeData.fire(undefined);
    }
    this.defaultOrg = usernameOrAlias;
  }

  public async refresh(node?: BrowserNode): Promise<void> {
    if (node && !node.toRefresh) {
      node.toRefresh = true;
    } else if (!this.toRefresh) {
      const usernameOrAlias = await this.getTargetOrgOrAlias();
      this.defaultOrg = usernameOrAlias;
      this.toRefresh = true;
    }
    this.internalOnDidChangeTreeData.fire(node);
  }

  public getTreeItem(element: BrowserNode): vscode.TreeItem {
    return element;
  }

  public getParent(element: BrowserNode) {
    return element.parent;
  }

  public async getChildren(element?: BrowserNode): Promise<BrowserNode[]> {
    if (isNullOrUndefined(this.defaultOrg)) {
      const emptyDefault = new BrowserNode(nls.localize('missing_default_org'), NodeType.EmptyNode);
      return Promise.resolve([emptyDefault]);
    }

    if (isNullOrUndefined(element)) {
      const org = new BrowserNode(this.defaultOrg, NodeType.Org);
      return Promise.resolve([org]);
    }

    switch (element.type) {
      case NodeType.Org:
        element.setTypes(await this.getTypes(), NodeType.MetadataType);
        this.toRefresh = false;
        break;
      case NodeType.Folder:
      case NodeType.MetadataType:
        let nodeType: NodeType = NodeType.MetadataComponent;
        if (TypeUtils.FOLDER_TYPES.has(element.fullName)) {
          nodeType = NodeType.Folder;
        } else if (element.parent && element.parent.fullName === CUSTOMOBJECTS_FULLNAME) {
          nodeType = NodeType.MetadataField;
        }

        element.setComponents(await this.getComponents(element), nodeType);
        element.toRefresh = false;
        break;
    }
    return Promise.resolve(element.children!);
  }

  public async getTypes(): Promise<MetadataObject[]> {
    const typeUtil = new TypeUtils();
    try {
      return await typeUtil.loadTypes(this.toRefresh);
    } catch (e) {
      throw parseErrors(e);
    }
  }

  public async getComponents(node: BrowserNode): Promise<string[]> {
    const cmpUtils = new ComponentUtils();
    try {
      let typeName;
      let folder;
      switch (node.type) {
        case NodeType.Folder:
          typeName = node.parent!.fullName;
          folder = node.fullName;
          break;
        case NodeType.MetadataType:
          if (TypeUtils.FOLDER_TYPES.has(node.fullName)) {
            const typeUtils = new TypeUtils();
            typeName = typeUtils.getFolderForType(node.fullName);
            break;
          }
        default:
          typeName = node.fullName;
      }

      const components = await cmpUtils.loadComponents(this.defaultOrg!, typeName, folder, node.toRefresh);

      return components;
    } catch (e) {
      throw parseErrors(e);
    }
  }

  public async getTargetOrgOrAlias(): Promise<string | undefined> {
    if (workspaceUtils.hasRootWorkspace()) {
      const username = await OrgAuthInfo.getTargetOrgOrAlias(false);
      return username;
    } else {
      throw new Error(nls.localize('cannot_determine_workspace'));
    }
  }
}

export const parseErrors = (error: any): Error => {
  try {
    const errMsg = typeof error === 'string' ? error : JSON.stringify(error);
    const e = extractJsonObject(errMsg);

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
    message += ' ' + nls.localize('error_org_browser_text');
    return new Error(message);
  } catch (e) {
    return new Error(e);
  }
};
