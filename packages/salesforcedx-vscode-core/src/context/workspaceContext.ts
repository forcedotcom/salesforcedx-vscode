/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import {
  OrgUserInfo,
  WorkspaceContextUtil,
  disposeTraceFlagExpiration,
  UserService,
  refreshAllExtensionReporters,
  handleTraceFlagCleanup,
  OrgAuthInfo
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { workspaceContextUtils } from '.';

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private coreExtensionContext?: vscode.ExtensionContext;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    const workspaceContextUtil = WorkspaceContextUtil.getInstance();
    this.onOrgChange = workspaceContextUtil.onOrgChange;
    this.onOrgChange(c => this.handleCliConfigChange(c));
    this.onOrgChange(c => this.handleOrgShapeChange(c));
    this.onOrgChange(() => this.handleTraceFlagCleanup());
    this.onOrgChange(() => this.handleTelemetryUpdate());
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    if (extensionContext.extension.id === 'salesforce.salesforcedx-vscode-core') {
      this.coreExtensionContext = extensionContext;
    }
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
    // Note: decorators.showOrg() has been moved to the salesforcedx-vscode-org extension
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
    if (!this.coreExtensionContext) {
      return;
    }

    try {
      await handleTraceFlagCleanup(this.coreExtensionContext);
    } catch (error) {
      // If the action performed results in no default org set, we need to remove the trace flag expiration
      disposeTraceFlagExpiration();
      console.log('Failed to perform trace flag cleanup after org change:', error);
    }
  };

  /** Update telemetry user ID when org changes */
  protected handleTelemetryUpdate = async () => {
    if (!this.coreExtensionContext) {
      return;
    }

    try {
      // Update the telemetry user ID in global state (Core extension doesn't use shared provider to avoid infinite loop)
      await UserService.getTelemetryUserId(this.coreExtensionContext);

      // Refresh telemetry reporters for ALL extensions (Core, Apex, etc.)
      await refreshAllExtensionReporters(this.coreExtensionContext);
    } catch (error) {
      console.log('Failed to update telemetry user ID after org change:', error);
    }
  };

  public get username(): string | undefined {
    return WorkspaceContextUtil.getInstance().username;
  }

  public get alias(): string | undefined {
    return WorkspaceContextUtil.getInstance().alias;
  }

  public get orgId(): string | undefined {
    return WorkspaceContextUtil.getInstance().orgId;
  }
}
