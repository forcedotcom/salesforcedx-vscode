/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConfigAggregator,
  Connection,
  SfdxConfigAggregator
} from '@salesforce/core';
import {
  OrgInfo,
  WorkspaceContextUtil
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import * as vscode from 'vscode';
import { setupWorkspaceOrgType } from '.';
import { getRootWorkspacePath } from '../util';

/**
 * Manages the context of a workspace during a session with an open SFDX project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;

  public readonly onOrgChange: vscode.Event<OrgInfo>;

  protected constructor() {
    this.onOrgChange = WorkspaceContextUtil.getInstance().onOrgChange;
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

  protected async handleCliConfigChange(orgInfo: OrgInfo) {
    setupWorkspaceOrgType(orgInfo.username).catch(e =>
      // error reported by setupWorkspaceOrgType
      console.error(e)
    );
    ConfigAggregatorProvider.getInstance().reloadConfigAggregators();
  }

  get username(): string | undefined {
    return WorkspaceContextUtil.getInstance().username;
  }

  get alias(): string | undefined {
    return WorkspaceContextUtil.getInstance().alias;
  }

  public async configAggregator(): Promise<ConfigAggregator> {
    const provider = ConfigAggregatorProvider.getInstance();
    const configAggregator = await provider.getConfigAggregator();
    return configAggregator;
  }

  public async sfdxConfigAggregator(): Promise<ConfigAggregator> {
    const provider = ConfigAggregatorProvider.getInstance();
    const sfdxConfigAggregator = provider.getSfdxConfigAggregator();
    return sfdxConfigAggregator;
  }

  public async globalConfigAggregator(): Promise<ConfigAggregator> {
    const provider = ConfigAggregatorProvider.getInstance();
    const globalConfigAggregator = provider.getGlobalConfigAggregator();
    return globalConfigAggregator;
  }
}

export { OrgInfo };
