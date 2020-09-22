import { AuthInfo, Connection } from '@salesforce/core';
import { join } from 'path';
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
  private subscribers = new Set<OrgSubscriber>();
  private cliConfigWatcher?: vscode.FileSystemWatcher;
  private sessionConnections = new Map<string, Connection>();
  private _orgUsername?: string;
  private _orgAlias?: string;

  private static instance?: WorkspaceContext;

  private constructor() {}

  public static async initialize(context: vscode.ExtensionContext) {
    const instance = new WorkspaceContext();
    const cliConfigPath = join(getRootWorkspacePath(), SFDX_FOLDER, SFDX_CONFIG_FILE);
    const bindedHandler = () => instance.handleCliConfigChange();

    instance.cliConfigWatcher?.dispose();
    instance.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(cliConfigPath);
    instance.cliConfigWatcher.onDidChange(bindedHandler);
    instance.cliConfigWatcher.onDidCreate(bindedHandler);
    instance.cliConfigWatcher.onDidDelete(bindedHandler);
    context.subscriptions.push(instance.cliConfigWatcher);

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

  /**
   * Subscribe to when the default org is set.
   *
   * @param subscriber Object to be notified
   * @param notifyNow Notify the subscriber immediately after subscribing
   */
  public subscribe(subscriber: OrgSubscriber, notifyNow = false) {
    this.subscribers.add(subscriber);
    if (notifyNow) {
      this.notifySubscriber(subscriber);
    }
  }

  public async getConnection(): Promise<Connection> {
    if (!this._orgUsername) {
      throw new Error(nls.localize('error_no_default_username'));
    }

    let connection = this.sessionConnections.get(this._orgUsername);
    if (!connection) {
      connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: this._orgUsername })
      });
      this.sessionConnections.set(this._orgUsername, connection);
    }

    return connection;
  }

  private async handleCliConfigChange() {
    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(false);

    if (usernameOrAlias) {
      this._orgUsername = await OrgAuthInfo.getUsername(usernameOrAlias);
      this._orgAlias =
        usernameOrAlias !== this._orgUsername ? usernameOrAlias : undefined;
    } else {
      this._orgUsername = undefined;
      this._orgAlias = undefined;
    }

    setupWorkspaceOrgType(this._orgUsername)
      .catch(e => console.error('Error setting VS Code org type context'));

    for (const subscriber of this.subscribers) {
      this.notifySubscriber(subscriber);
    }
  }

  private notifySubscriber(subscriber: OrgSubscriber): void {
    subscriber
      .onOrgChange(this._orgUsername, this._orgAlias)
      .catch(e => {
        const subscriberName = subscriber.constructor.name;
        const message = `Error in callback for subscriber ${subscriberName}: ${e.message}`;
        telemetryService.sendException('WorkspaceContextError', message);
        console.error(message);
      });
  }

  get orgUsername(): string | undefined {
    return this._orgUsername;
  }

  get orgAlias(): string | undefined {
    return this._orgAlias;
  }
}
