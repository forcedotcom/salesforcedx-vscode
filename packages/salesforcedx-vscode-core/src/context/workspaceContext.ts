import { AuthInfo, Connection } from '@salesforce/core';
import path = require('path');
import * as vscode from 'vscode';
import { setupWorkspaceOrgType } from '.';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../constants';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, OrgAuthInfo } from '../util';

export interface OrgSubscriber {
  onOrgChange(username?: string, alias?: string): Promise<void>;
}

/**
 * Manages the context of a workspace during a session with an open SFDX project.
 */
export class WorkspaceContext {
  private cliConfigWatcher: vscode.FileSystemWatcher;
  private subscribers = new Set<OrgSubscriber>();
  private sessionConnections = new Map<string, Connection>();
  private _username?: string;
  private _alias?: string;

  private static instance?: WorkspaceContext;

  private constructor(context: vscode.ExtensionContext) {
    const sfdxProjectPath = getRootWorkspacePath();
    this.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(
      path.join(sfdxProjectPath, SFDX_FOLDER, SFDX_CONFIG_FILE)
    );
    this.cliConfigWatcher.onDidChange(() => this.handleCliConfigChange());
    this.cliConfigWatcher.onDidCreate(() => this.handleCliConfigChange());
    this.cliConfigWatcher.onDidDelete(() => this.handleCliConfigChange());
    context.subscriptions.push(this.cliConfigWatcher);
  }

  public static async initialize(context: vscode.ExtensionContext) {
    WorkspaceContext.instance = new WorkspaceContext(context);
    await WorkspaceContext.instance.handleCliConfigChange();
  }

  public static get(): WorkspaceContext {
    if (!this.instance) {
      telemetryService.sendException(
        'WorkspaceContextException',
        'Workspace context has not been initialized'
      );
      throw new Error(nls.localize('error_workspace_context_init'));
    }
    return this.instance;
  }

  /**
   * Subscribe to when the default org is set.
   *
   * @param subscriber Object to be notified
   */
  public subscribe(subscriber: OrgSubscriber) {
    this.subscribers.add(subscriber);
    subscriber.onOrgChange(this._username, this._alias);
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

  private async handleCliConfigChange() {
    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    if (usernameOrAlias) {
      this._username = await OrgAuthInfo.getUsername(usernameOrAlias);
      this._alias =
        usernameOrAlias !== this._username ? usernameOrAlias : undefined;
      setupWorkspaceOrgType(usernameOrAlias);
      for (const subscriber of this.subscribers) {
        subscriber.onOrgChange(this._username, this._alias);
      }
    }
  }

  get username() {
    return this._username;
  }

  get alias() {
    return this._alias;
  }
}
