/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { join } from 'path';
import * as vscode from 'vscode';
import { AuthUtil } from '../auth';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../constants';
import { nls } from '../messages';
import { getRootWorkspacePath } from '../workspaces';

export interface OrgInfo {
  username?: string;
  alias?: string;
}

/**
 * Manages the context of a workspace during a session with an open SFDX project.
 */
export class WorkspaceContextUtil {
  protected static instance?: WorkspaceContextUtil;

  protected cliConfigWatcher: vscode.FileSystemWatcher;
  protected sessionConnections: Map<string, Connection>;
  protected onOrgChangeEmitter: vscode.EventEmitter<OrgInfo>;
  protected _username?: string;
  protected _alias?: string;

  public readonly onOrgChange: vscode.Event<OrgInfo>;

  protected constructor() {
    this.sessionConnections = new Map<string, Connection>();
    this.onOrgChangeEmitter = new vscode.EventEmitter<OrgInfo>();
    this.onOrgChange = this.onOrgChangeEmitter.event;

    const bindedHandler = () => this.handleCliConfigChange();
    const cliConfigPath = join(getRootWorkspacePath(), SFDX_FOLDER, SFDX_CONFIG_FILE);
    this.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(cliConfigPath);
    this.cliConfigWatcher.onDidChange(bindedHandler);
    this.cliConfigWatcher.onDidCreate(bindedHandler);
    this.cliConfigWatcher.onDidDelete(bindedHandler);
  }

  public getAuthUtil(): AuthUtil { return AuthUtil.getInstance(); }

  public async initialize(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.cliConfigWatcher, this.onOrgChangeEmitter, this.cliConfigWatcher);
    await this.handleCliConfigChange();
  }

  public static getInstance(forceNew = false): WorkspaceContextUtil {
    if (!this.instance || forceNew) {
      this.instance = new WorkspaceContextUtil();
    }
    return this.instance;
  }

  public async getConnection(): Promise<Connection> {
    if (!this._username) {
      throw new Error(nls.localize('error_no_default_username'));
    }

    let connection = this.sessionConnections.get(this._username);
    if (!connection) {
      connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: this._username })
      });
      this.sessionConnections.set(this._username, connection);
    }

    return connection;
  }

  protected async handleCliConfigChange() {
    const usernameOrAlias = await this.getAuthUtil().getDefaultUsernameOrAlias(false);

    if (usernameOrAlias) {
      this._username = await this.getAuthUtil().getUsername(usernameOrAlias);
      this._alias =
        usernameOrAlias !== this._username ? usernameOrAlias : undefined;
    } else {
      this._username = undefined;
      this._alias = undefined;
    }

    this.onOrgChangeEmitter.fire({ username: this._username, alias: this._alias });
  }

  get username(): string | undefined {
    return this._username;
  }

  get alias(): string | undefined {
    return this._alias;
  }
}
