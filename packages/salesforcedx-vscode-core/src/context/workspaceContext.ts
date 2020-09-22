import { AuthInfo, Connection } from '@salesforce/core';
import { join } from 'path';
import * as vscode from 'vscode';
import { setupWorkspaceOrgType } from '.';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../constants';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, OrgAuthInfo } from '../util';

export interface OrgInfo {
  username?: string;
  alias?: string;
}

/**
 * Manages the context of a workspace during a session with an open SFDX project.
 */
export class WorkspaceContext {
  private static instance?: WorkspaceContext;

  private cliConfigWatcher?: vscode.FileSystemWatcher;
  private sessionConnections = new Map<string, Connection>();
  private _username?: string;
  private _alias?: string;
  private readonly onOrgChangeEmitter = new vscode.EventEmitter<OrgInfo>();

  public readonly onOrgChange = this.onOrgChangeEmitter.event;

  private constructor() {}

  public static async initialize(context: vscode.ExtensionContext) {
    this.instance?.onOrgChangeEmitter.dispose();
    this.instance?.cliConfigWatcher?.dispose();

    const instance = new WorkspaceContext();
    const bindedHandler = () => instance.handleCliConfigChange();
    const cliConfigPath = join(getRootWorkspacePath(), SFDX_FOLDER, SFDX_CONFIG_FILE);

    instance.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(cliConfigPath);
    instance.cliConfigWatcher.onDidChange(bindedHandler);
    instance.cliConfigWatcher.onDidCreate(bindedHandler);
    instance.cliConfigWatcher.onDidDelete(bindedHandler);
    context.subscriptions.push(instance.cliConfigWatcher, instance.onOrgChangeEmitter, instance.cliConfigWatcher);

    await instance.handleCliConfigChange();

    this.instance = instance;
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
    } else {
      this._username = undefined;
      this._alias = undefined;
    }

    setupWorkspaceOrgType(this._username).catch(e =>
      // error reported by setupWorkspaceOrgType
      console.error(e)
    );

    this.onOrgChangeEmitter.fire({ username: this._username, alias: this._alias });
  }

  get username(): string | undefined {
    return this._username;
  }

  get alias(): string | undefined {
    return this._alias;
  }
}
