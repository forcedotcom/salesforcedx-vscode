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

    if (!element.children) {
      switch (element.type) {
        case NodeType.Org:
          element.setChildren(await this.getTypes(), NodeType.MetadataType);
          break;
        case NodeType.Folder:
        case NodeType.MetadataType:
          const type = TypeUtils.FOLDER_TYPES.has(element.fullName)
            ? NodeType.Folder
            : NodeType.MetadataCmp;
          element.setChildren(await this.getComponents(element), type);
          break;
      }
    }
    return Promise.resolve(element.children!);
  }

  public async getTypes(): Promise<string[]> {
    const username = this.defaultOrg!;
    const typeUtil = new TypeUtils();
    try {
      return await typeUtil.loadTypes(username);
    } catch (e) {
      throw parseErrors(e);
    }
  }

  public async getComponents(node: BrowserNode): Promise<string[]> {
    const cmpUtils = new ComponentUtils();
    try {
      if (TypeUtils.FOLDER_TYPES.has(node.fullName)) {
        const typeUtils = new TypeUtils();
        return await cmpUtils.loadComponents(
          this.defaultOrg!,
          typeUtils.getFolderForType(node.fullName)
        );
      } else if (node.type === NodeType.Folder) {
        return await cmpUtils.loadComponents(
          this.defaultOrg!,
          node.parent!.fullName,
          node.fullName
        );
      }
      return await cmpUtils.loadComponents(this.defaultOrg!, node.fullName);
    } catch (e) {
      throw parseErrors(e);
    }
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

function parseErrors(error: string): Error {
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
  message += ' ' + nls.localize('error_org_browser_text');
  return new Error(message);
}
