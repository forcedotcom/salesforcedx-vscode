/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, Global } from '@salesforce/core';
import { getRootWorkspacePath, OrgInfo, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode/out/src';
import * as path from 'path';
import * as vscode from 'vscode';
import { setupWorkspaceOrgType } from '.';

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
  }

  get username(): string | undefined {
    return WorkspaceContextUtil.getInstance().username;
  }

  get alias(): string | undefined {
    return WorkspaceContextUtil.getInstance().alias;
  }

  public getSfdxDirectoryPath(): string {
    return path.join(
      getRootWorkspacePath(),
      Global.SFDX_STATE_FOLDER
    );
  }

  public getMetadataDirectoryPath(username: string): string {
    return path.join(
      this.getSfdxDirectoryPath(),
      'orgs',
      username,
      'metadata'
    );
  }

}

export { OrgInfo };
