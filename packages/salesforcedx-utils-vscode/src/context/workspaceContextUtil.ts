/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator } from '@salesforce/core-bundle';
import * as vscode from 'vscode';
import { ConfigAggregatorProvider, TelemetryService } from '..';
import { ConfigUtil } from '../config/configUtil';
import { projectPaths } from '../helpers';
import { nls } from '../messages';

export type OrgUserInfo = {
  username?: string;
  alias?: string;
};

export type OrgShape = 'Scratch' | 'Sandbox' | 'Production' | 'Undefined';

export const WORKSPACE_CONTEXT_ORG_ID_ERROR = 'workspace_context_org_id_error';
/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContextUtil {
  protected static instance?: WorkspaceContextUtil;

  protected cliConfigWatcher: vscode.FileSystemWatcher;
  protected sessionConnections: Map<string, Connection>;
  protected onOrgChangeEmitter: vscode.EventEmitter<OrgUserInfo>;
  protected _username?: string;
  protected _alias?: string;
  protected _orgId?: string;
  protected _orgShape?: OrgShape;
  protected _devHubId?: string;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    this.sessionConnections = new Map<string, Connection>();
    this.onOrgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();
    this.onOrgChange = this.onOrgChangeEmitter.event;

    const bindedHandler = () => this.handleCliConfigChange();
    const cliConfigPath = projectPaths.salesforceProjectConfig();
    this.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(cliConfigPath);
    this.cliConfigWatcher.onDidChange(bindedHandler);
    this.cliConfigWatcher.onDidCreate(bindedHandler);
    this.cliConfigWatcher.onDidDelete(bindedHandler);
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(this.cliConfigWatcher, this.onOrgChangeEmitter, this.cliConfigWatcher);
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
      throw new Error(nls.localize('error_no_target_org'));
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

  /**
   * Creates a connection for the current target org, bypassing any caching.
   * This is useful when you need a fresh connection after setting a new target org.
   * @returns Promise<Connection> - A new connection to the target org
   * @throws Error if no target org is set or connection cannot be created
   */
  public static async createFreshConnectionForTargetOrg(): Promise<Connection> {
    // Check if the target org was successfully set by reading it back
    const actualTargetOrg = await ConfigUtil.getTargetOrgOrAlias();
    if (!actualTargetOrg) {
      throw new Error('createFreshConnectionForTargetOrg() failed - No target org found');
    }

    console.log('New target org is:', actualTargetOrg);

    // Get the actual username for the target org (in case actualTargetOrg is an alias)
    const username = await ConfigUtil.getUsernameFor(actualTargetOrg);
    console.log('Using username for connection:', username);

    // Create a connection directly using the actual username
    // This bypasses the WorkspaceContextUtil's caching which might not be updated yet
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });

    return connection;
  }

  protected async handleCliConfigChange() {
    // Core's types can return stale cached data when
    // this handler is called right after modifying the config file.
    // Reloading the Config Aggregator and StateAggregator here ensures
    // that they are refreshed when the config file changes, and are
    // loaded with the most recent data when used downstream in ConfigUtil.
    await ConfigAggregatorProvider.getInstance().reloadConfigAggregators();
    StateAggregator.clearInstance();

    const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();

    if (targetOrgOrAlias) {
      this._username = await ConfigUtil.getUsernameFor(targetOrgOrAlias);
      this._alias = targetOrgOrAlias !== this._username ? targetOrgOrAlias : undefined;
      try {
        const connection = await this.getConnection();
        this._orgId = connection?.getAuthInfoFields().orgId;
      } catch (error: unknown) {
        this._orgId = '';
        if (error instanceof Error) {
          console.log('There was an problem getting the orgId of the default org: ', error);
          TelemetryService.getInstance().sendException(
            WORKSPACE_CONTEXT_ORG_ID_ERROR,
            `name: ${error.name}, message: ${error.message}`
          );
        }
      }
    } else {
      this._username = undefined;
      this._alias = undefined;
    }

    this.onOrgChangeEmitter.fire({
      username: this._username,
      alias: this._alias
    });
  }

  get username(): string | undefined {
    return this._username;
  }

  get alias(): string | undefined {
    return this._alias;
  }

  get orgId(): string | undefined {
    return this._orgId;
  }

  get orgShape(): OrgShape | undefined {
    return this._orgShape;
  }

  set orgShape(shape: OrgShape) {
    this._orgShape = shape;
  }

  get devHubId(): string | undefined {
    return this._devHubId;
  }

  set devHubId(id: string | undefined) {
    this._devHubId = id;
  }
}
