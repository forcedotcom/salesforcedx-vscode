/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core-bundle';
import { OrgUserInfo, WorkspaceContextUtil, TraceFlags, disposeTraceFlagExpiration } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { APEX_CODE_DEBUG_LEVEL } from '../constants';
import { decorators } from '../decorators';
import { OrgAuthInfo } from '../util/authInfo';
import { workspaceContextUtils } from '.';

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private extensionContext?: vscode.ExtensionContext;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    const workspaceContextUtil = WorkspaceContextUtil.getInstance();
    this.onOrgChange = workspaceContextUtil.onOrgChange;
    this.onOrgChange(this.handleCliConfigChange);
    this.onOrgChange(this.handleOrgShapeChange);
    this.onOrgChange(this.handleTraceFlagCleanup);
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    this.extensionContext = extensionContext;
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

  protected async handleCliConfigChange(orgInfo: OrgUserInfo) {
    await workspaceContextUtils.setupWorkspaceOrgType(orgInfo.username).catch(e =>
      // error reported by setupWorkspaceOrgType
      console.error(e)
    );

    await decorators.showOrg();
  }

  protected async handleOrgShapeChange(orgInfo: OrgUserInfo) {
    const { username } = orgInfo;
    if (username !== undefined) {
      const orgShape = await workspaceContextUtils.getOrgShape(username);
      if (orgShape !== 'Undefined') {
        WorkspaceContextUtil.getInstance().orgShape = orgShape;
        WorkspaceContextUtil.getInstance().devHubId = undefined;
      }
      if (orgShape === 'Scratch') {
        const devHubId = await OrgAuthInfo.getDevHubIdFromScratchOrg(username);
        WorkspaceContextUtil.getInstance().devHubId = devHubId;
      }
    }
  }

  /** Handle trace flag cleanup when org changes */
  protected handleTraceFlagCleanup = async () => {
    if (!this.extensionContext) {
      return;
    }

    try {
      const connection = await WorkspaceContextUtil.getInstance().getConnection();
      const traceFlags = new TraceFlags(connection);
      await traceFlags.handleTraceFlagCleanup(
        this.extensionContext,
        APEX_CODE_DEBUG_LEVEL
      );
    } catch (error) {
      // If the action performed results in no default org set, we need to remove the trace flag expiration
      disposeTraceFlagExpiration();
      console.log('Failed to perform trace flag cleanup after org change:', error);
    }
  };

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
