/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator } from '@salesforce/core';
import * as util from 'node:util';
import * as vscode from 'vscode';
import { ConfigAggregatorProvider, TelemetryService } from '..';
import { ChannelService } from '../commands/channelService';
import { ConfigUtil } from '../config/configUtil';
import {
  addKnownBadConnection,
  clearKnownBadConnection,
  clearSharedLoginPrompt,
  getSharedLoginPrompt,
  isKnownBadConnection,
  setSharedLoginPrompt
} from '../helpers/authUtils';
import { projectPaths } from '../helpers/paths';
import { nls } from '../messages/messages';

export type OrgUserInfo = {
  username?: string;
  alias?: string;
};

export type OrgShape = 'Scratch' | 'Sandbox' | 'Production' | 'Undefined';
type ConnectionDetails = { connection: Connection; lastTokenValidationTimestamp?: number };
export const WORKSPACE_CONTEXT_ORG_ID_ERROR = 'workspace_context_org_id_error';

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContextUtil {
  protected static instance?: WorkspaceContextUtil;

  protected cliConfigWatcher: vscode.FileSystemWatcher;
  protected sessionConnections: Map<string, ConnectionDetails>;
  protected onOrgChangeEmitter: vscode.EventEmitter<OrgUserInfo>;
  protected _username?: string;
  protected _alias?: string;
  protected _orgId?: string;
  protected _orgShape?: OrgShape;
  protected _devHubId?: string;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    this.sessionConnections = new Map<string, ConnectionDetails>();
    this.onOrgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();
    this.onOrgChange = this.onOrgChangeEmitter.event;

    const cliConfigPath = projectPaths.salesforceProjectConfig();
    this.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(cliConfigPath);
    this.cliConfigWatcher.onDidChange(() => this.handleCliConfigChange());
    this.cliConfigWatcher.onDidCreate(() => this.handleCliConfigChange());
    this.cliConfigWatcher.onDidDelete(() => this.handleCliConfigChange());
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

    if (!this.sessionConnections.has(this._username)) {
      const connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: this._username })
      });
      this.sessionConnections.set(this._username, { connection });
    }

    // it was either present or we just created it.
    const connectionDetails = this.sessionConnections.get(this._username)!;

    // if we won't be able to refresh the connection because it's access-token only
    // validate that it still works and provide a good error message if it's not
    if (connectionDetails.connection.getAuthInfo().isAccessTokenFlow()) {
      try {
        if (
          connectionDetails.lastTokenValidationTimestamp === undefined ||
          Date.now() - connectionDetails.lastTokenValidationTimestamp > 1000 * 60 * 5 // 5 minutes
        ) {
          await connectionDetails.connection.identity();
          clearKnownBadConnection(this._username);
          this.sessionConnections.set(this._username, {
            connection: connectionDetails.connection,
            lastTokenValidationTimestamp: Date.now()
          });
          return connectionDetails.connection;
        }
      } catch (e) {
        const channel = ChannelService.getInstance('Salesforce Org Management');
        channel.appendLine(`Error refreshing access token: ${util.inspect(e, { depth: null, showHidden: true })}`);
        channel.showChannelOutput();

        this.sessionConnections.delete(this._username);

        // Check if there's already an active login prompt for this user (shared across all extensions)
        const existingPrompt = await getSharedLoginPrompt(this._username);

        // we only want to display one message per username across ALL extensions, even though many consumers are requesting connections.
        const isKnownBad = isKnownBadConnection(this._username);
        if (!isKnownBad && !existingPrompt) {
          addKnownBadConnection(this._username);

          // Capture username for use in async closure
          const username = this._username;

          // Create placeholder promise and register it IMMEDIATELY in shared state to block other concurrent calls from ALL extensions
          let resolvePromise: () => void;
          const placeholderPromise = new Promise<void>(resolve => {
            resolvePromise = resolve;
          });
          setSharedLoginPrompt(username, placeholderPromise);

          // Create and execute the login prompt
          const dialogId = Date.now();
          void (async () => {
            try {
              const selection = await vscode.window.showErrorMessage(
                `${nls.localize('error_access_token_expired')} [${dialogId}]`,
                {
                  modal: true,
                  detail: nls.localize('error_access_token_expired_detail')
                },
                nls.localize('error_access_token_expired_login_button')
              );
              if (selection === 'Login') {
                await vscode.commands.executeCommand('sf.org.login.web', connectionDetails.connection.instanceUrl);
              }
              // Note: We keep the username in knownBadConnections regardless of Cancel/Login
              // This prevents other extensions from showing duplicate popups
            } finally {
              resolvePromise!();
            }
          })();

          try {
            await placeholderPromise;
          } finally {
            clearSharedLoginPrompt(username);
          }
        }
        throw new Error('Unable to refresh your access token.  Please login again.');
      }
    }
    return connectionDetails.connection;
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
      this._orgId = undefined;
    }

    this.onOrgChangeEmitter.fire({
      username: this._username,
      alias: this._alias
    });
  }

  public get username(): string | undefined {
    return this._username;
  }

  public get alias(): string | undefined {
    return this._alias;
  }

  public get orgId(): string | undefined {
    return this._orgId;
  }

  public get orgShape(): OrgShape | undefined {
    return this._orgShape;
  }

  public set orgShape(shape: OrgShape) {
    this._orgShape = shape;
  }

  public get devHubId(): string | undefined {
    return this._devHubId;
  }

  public set devHubId(id: string | undefined) {
    this._devHubId = id;
  }
}
