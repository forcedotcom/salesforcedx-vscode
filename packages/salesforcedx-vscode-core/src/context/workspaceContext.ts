/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core-bundle';
import {
  CommandEventStream,
  OrgUserInfo,
  WorkspaceContextUtil
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { workspaceContextUtils } from '.';
import { CommandLog } from '../commands/util';
import { decorators } from '../decorators';

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;

  protected workspaceStore: vscode.Memento;
  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    const workspaceContextUtil = WorkspaceContextUtil.getInstance();
    this.onOrgChange = workspaceContextUtil.onOrgChange;
    this.onOrgChange(this.handleCliConfigChange);
    this.workspaceStore = {} as vscode.Memento;
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    await WorkspaceContextUtil.getInstance().initialize(extensionContext);
    this.workspaceStore = extensionContext.workspaceState;
    CommandEventStream.getInstance().initialize(extensionContext);
    CommandLog.getInstance().initialize();
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

  protected async handleCliConfigChange(orgInfo: OrgUserInfo) {
    await workspaceContextUtils
      .setupWorkspaceOrgType(orgInfo.username)
      .catch(e =>
        // error reported by setupWorkspaceOrgType
        console.error(e)
      );

    await decorators.showOrg();
  }

  get workspaceState(): vscode.Memento {
    return this.workspaceStore;
  }

  get username(): string | undefined {
    return WorkspaceContextUtil.getInstance().username;
  }

  get alias(): string | undefined {
    return WorkspaceContextUtil.getInstance().alias;
  }

  get orgId(): string | undefined {
    return WorkspaceContextUtil.getInstance().orgId;
  }
}
