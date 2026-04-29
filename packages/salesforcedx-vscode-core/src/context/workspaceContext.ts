/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  OrgUserInfo,
  WorkspaceContextUtil,
  UserService,
  refreshAllExtensionReporters,
  getDevHubIdFromScratchOrg
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';
import { workspaceContextUtils } from '.';

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private coreExtensionContext?: vscode.ExtensionContext;
  private initializationPromise?: Promise<void>;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    const workspaceContextUtil = WorkspaceContextUtil.getInstance();
    this.onOrgChange = workspaceContextUtil.onOrgChange;
    this.onOrgChange(c => this.handleOrgShapeChange(c));
    this.onOrgChange(() => this.handleTelemetryUpdate());
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    this.initializationPromise ??= this._doInitialize(extensionContext);
    return this.initializationPromise;
  }

  private async _doInitialize(extensionContext: vscode.ExtensionContext) {
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

  // @deprecated. Use getConnection from the Services extension.
  // maintained for backward compatibility for 2PP using vscode-core API
  public async getConnection(): Promise<Connection> {
    return getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* api.services.ConnectionService.getConnection();
      })
    );
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
        const devHubId = await getDevHubIdFromScratchOrg(username);
        WorkspaceContextUtil.getInstance().devHubId = devHubId;
      }
    }
  }

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
