/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import {
  ConfigUtil,
  OrgUserInfo,
  WorkspaceContextUtil
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { workspaceContextUtils } from '.';
import { decorators } from '../decorators';
import { OrgAuthInfo } from '../util';

/**
 * Manages the context of a workspace during a session with an open SFDX project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    const wcu = WorkspaceContextUtil.getInstance();
    this.onOrgChange = wcu.onOrgChange;
    this.onOrgChange(this.handleCliConfigChange);
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    await WorkspaceContextUtil.getInstance().initialize(extensionContext);
  }

  public static getInstance(forceNew = false): WorkspaceContext {
    if (!this.instance || forceNew) {
      this.instance = new WorkspaceContext();
    }
    return this.instance;
  }

  public async getConnection(): Promise<Connection> {
    return await WorkspaceContextUtil.getInstance().getConnection();
  }

  protected async setIsScratchOrg() {
    const username = await ConfigUtil.getUsername();
    if (!username) {
      return;
    }
    const isScratchOrg = await OrgAuthInfo.isAScratchOrg(username);
    vscode.commands.executeCommand(
      'setContext',
      'sfdx:is_scratch_org',
      isScratchOrg
    );
  }

  protected async handleCliConfigChange(orgInfo: OrgUserInfo) {
    workspaceContextUtils.setupWorkspaceOrgType(orgInfo.username).catch(e =>
      // error reported by setupWorkspaceOrgType
      console.error(e)
    );

    await this.setIsScratchOrg();

    await decorators.showOrg();
  }

  get username(): string | undefined {
    return WorkspaceContextUtil.getInstance().username;
  }

  get alias(): string | undefined {
    return WorkspaceContextUtil.getInstance().alias;
  }
}
