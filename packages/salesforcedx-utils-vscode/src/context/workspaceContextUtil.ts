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
import { projectPaths } from '../helpers/paths';
import { nls } from '../messages/messages';

// Global interception to track ALL showErrorMessage calls
const originalShowErrorMessage = vscode.window.showErrorMessage;
// @ts-ignore - Intercepting for debugging, intentionally bypassing type checks
vscode.window.showErrorMessage = function (...args: any[]) {
  console.log('🔴 showErrorMessage CALLED:', args[0], 'STACK:', new Error().stack);
  // @ts-ignore
  return originalShowErrorMessage.apply(vscode.window, args);
};

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
// Use global symbol to ensure singleton across all bundles
const WORKSPACE_CONTEXT_SYMBOL = Symbol.for('salesforce.workspaceContextUtil.singleton');

export class WorkspaceContextUtil {
  protected static instance?: WorkspaceContextUtil;
  private static instanceCounter = 0;
  private readonly instanceId: number;

  protected cliConfigWatcher: vscode.FileSystemWatcher;
  protected sessionConnections: Map<string, ConnectionDetails>;
  protected onOrgChangeEmitter: vscode.EventEmitter<OrgUserInfo>;
  protected _username?: string;
  protected _alias?: string;
  protected _orgId?: string;
  protected _orgShape?: OrgShape;
  protected _devHubId?: string;

  private knownBadConnections: Set<string> = new Set();
  private activeLoginPrompts: Map<string, Promise<void>> = new Map();
  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
    this.instanceId = ++WorkspaceContextUtil.instanceCounter;
    console.log(`workspaceContextUtil.ts - enter constructor() [instance: ${this.instanceId}]`);
    this.sessionConnections = new Map<string, ConnectionDetails>();
    console.log('workspaceContextUtil.ts constructor() - 1');
    this.onOrgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();
    console.log('workspaceContextUtil.ts constructor() - 2');
    this.onOrgChange = this.onOrgChangeEmitter.event;
    console.log('workspaceContextUtil.ts constructor() - 3');

    const cliConfigPath = projectPaths.salesforceProjectConfig();
    console.log('workspaceContextUtil.ts constructor() - 4');
    this.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(cliConfigPath);
    console.log('workspaceContextUtil.ts constructor() - 5');
    this.cliConfigWatcher.onDidChange(() => this.handleCliConfigChange());
    console.log('workspaceContextUtil.ts constructor() - 6');
    this.cliConfigWatcher.onDidCreate(() => this.handleCliConfigChange());
    console.log('workspaceContextUtil.ts constructor() - 7');
    this.cliConfigWatcher.onDidDelete(() => this.handleCliConfigChange());
    console.log('workspaceContextUtil.ts - exit constructor()');
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    console.log('workspaceContextUtil.ts - enter initialize()');
    extensionContext.subscriptions.push(this.cliConfigWatcher, this.onOrgChangeEmitter, this.cliConfigWatcher);
    console.log('workspaceContextUtil.ts initialize() - 1');
    await this.handleCliConfigChange();
    console.log('workspaceContextUtil.ts - exit initialize()');
  }

  public static getInstance(forceNew = false): WorkspaceContextUtil {
    console.log('workspaceContextUtil.ts - enter getInstance()');

    // Use global symbol to ensure singleton across all extension bundles
    // @ts-ignore - Using global for cross-bundle singleton
    const globalObj: Record<symbol, WorkspaceContextUtil> = global;

    if (!globalObj[WORKSPACE_CONTEXT_SYMBOL] || forceNew) {
      console.log('workspaceContextUtil.ts getInstance() - 1 (creating NEW global instance)');
      globalObj[WORKSPACE_CONTEXT_SYMBOL] = new WorkspaceContextUtil();
      console.log('workspaceContextUtil.ts getInstance() - 2');
    } else {
      console.log('workspaceContextUtil.ts getInstance() - using EXISTING global instance');
    }

    this.instance = globalObj[WORKSPACE_CONTEXT_SYMBOL];
    console.log('workspaceContextUtil.ts - exit getInstance()');
    return this.instance!;
  }

  public async getConnection(): Promise<Connection> {
    console.log(`workspaceContextUtil.ts - enter getConnection() [instance: ${this.instanceId}]`);
    if (!this._username) {
      console.log('workspaceContextUtil.ts getConnection() - 1');
      throw new Error(nls.localize('error_no_target_org'));
    }
    console.log('workspaceContextUtil.ts getConnection() - 2');
    if (!this.sessionConnections.has(this._username)) {
      console.log('workspaceContextUtil.ts getConnection() - 3');
      const connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: this._username })
      });
      console.log('workspaceContextUtil.ts getConnection() - 4');
      this.sessionConnections.set(this._username, { connection });
      console.log('workspaceContextUtil.ts getConnection() - 5');
    }
    console.log('workspaceContextUtil.ts getConnection() - 6');
    // it was either present or we just created it.
    const connectionDetails = this.sessionConnections.get(this._username)!;
    console.log('workspaceContextUtil.ts getConnection() - 7');
    // if we won't be able to refresh the connection because it's access-token only
    // validate that it still works and provide a good error message if it's not
    if (connectionDetails.connection.getAuthInfo().isAccessTokenFlow()) {
      console.log('workspaceContextUtil.ts getConnection() - 8');
      try {
        console.log('workspaceContextUtil.ts getConnection() - 9');
        if (
          connectionDetails.lastTokenValidationTimestamp === undefined ||
          Date.now() - connectionDetails.lastTokenValidationTimestamp > 1000 * 60 * 5 // 5 minutes
        ) {
          console.log('workspaceContextUtil.ts getConnection() - 10');
          await connectionDetails.connection.identity(); // THIS LINE FAILED
          // There was no identity because the user was logged out.
          // The issue is that this step is *part of the initialization of the CLI Integration extension*.
          // Therefore the workaround was to login again via CLI.
          console.log('workspaceContextUtil.ts getConnection() - 11');
          this.knownBadConnections.delete(this._username);
          console.log('workspaceContextUtil.ts getConnection() - 12');
          this.sessionConnections.set(this._username, {
            connection: connectionDetails.connection,
            lastTokenValidationTimestamp: Date.now()
          });
          console.log('workspaceContextUtil.ts - exit 1 getConnection()');
          return connectionDetails.connection;
        }
        console.log('workspaceContextUtil.ts getConnection() - 13');
      } catch (e) {
        console.log('workspaceContextUtil.ts getConnection() - 14');
        const channel = ChannelService.getInstance('Salesforce Org Management');
        console.log('workspaceContextUtil.ts getConnection() - 15');
        channel.appendLine(`Error refreshing access token: ${util.inspect(e, { depth: null, showHidden: true })}`);
        console.log('workspaceContextUtil.ts getConnection() - 16');
        channel.showChannelOutput();
        console.log('workspaceContextUtil.ts getConnection() - 17');
        this.sessionConnections.delete(this._username);
        console.log('workspaceContextUtil.ts getConnection() - 18');

        // Check if there's already an active login prompt for this user
        const existingPrompt = this.activeLoginPrompts.get(this._username);
        if (existingPrompt) {
          console.log('workspaceContextUtil.ts getConnection() - 18A (waiting for existing prompt)');
          await existingPrompt;
          console.log('workspaceContextUtil.ts getConnection() - 18B');
          throw new Error('Unable to refresh your access token.  Please login again.');
        }

        // we only want to display one message per username, even though many consumers are requesting connections.
        console.log(
          `workspaceContextUtil.ts getConnection() - 18.9 (instance: ${this.instanceId}, knownBad: ${this.knownBadConnections.has(this._username)}, activePrompt: ${this.activeLoginPrompts.has(this._username)})`
        );
        if (!this.knownBadConnections.has(this._username) && !this.activeLoginPrompts.has(this._username)) {
          console.log(
            `workspaceContextUtil.ts getConnection() - 19 (CREATING DIALOG from instance ${this.instanceId})`
          );
          this.knownBadConnections.add(this._username);

          // Capture username for use in async closure
          const username = this._username;

          // Create placeholder promise and register it IMMEDIATELY to block other concurrent calls
          let resolvePromise: () => void;
          const placeholderPromise = new Promise<void>(resolve => {
            resolvePromise = resolve;
          });
          this.activeLoginPrompts.set(username, placeholderPromise);

          // Create and execute the login prompt
          const dialogId = Date.now();
          console.log(`workspaceContextUtil.ts getConnection() - 19.5 (DIALOG ID: ${dialogId})`);
          console.log(`STACK TRACE FOR DIALOG ${dialogId}:`, new Error().stack);
          void (async () => {
            try {
              console.log(
                `workspaceContextUtil.ts getConnection() - 20 (DIALOG ID: ${dialogId}) - ABOUT TO SHOW DIALOG`
              );
              const selection = await vscode.window.showErrorMessage(
                `${nls.localize('error_access_token_expired')} [${dialogId}]`,
                {
                  modal: true,
                  detail: nls.localize('error_access_token_expired_detail')
                },
                nls.localize('error_access_token_expired_login_button')
              );
              console.log('workspaceContextUtil.ts getConnection() - 21');
              if (selection === 'Login') {
                console.log('workspaceContextUtil.ts getConnection() - 22');
                await vscode.commands.executeCommand('sf.org.login.web', connectionDetails.connection.instanceUrl);
                console.log('workspaceContextUtil.ts getConnection() - 23');
              } else {
                // User dismissed or cancelled - clear knownBadConnections so they can see the dialog again if needed
                this.knownBadConnections.delete(username);
              }
              console.log('workspaceContextUtil.ts getConnection() - 24');
            } finally {
              resolvePromise!();
            }
          })();

          try {
            await placeholderPromise;
          } finally {
            this.activeLoginPrompts.delete(username);
          }
        }
        console.log('workspaceContextUtil.ts getConnection() - 25');
        throw new Error('Unable to refresh your access token.  Please login again.');
      }
      console.log('workspaceContextUtil.ts getConnection() - 26');
    }
    console.log('workspaceContextUtil.ts - exit 2 getConnection()');
    return connectionDetails.connection;
  }

  protected async handleCliConfigChange() {
    // Core's types can return stale cached data when
    // this handler is called right after modifying the config file.
    // Reloading the Config Aggregator and StateAggregator here ensures
    // that they are refreshed when the config file changes, and are
    // loaded with the most recent data when used downstream in ConfigUtil.
    console.log('workspaceContextUtil.ts - enter handleCliConfigChange()');
    await ConfigAggregatorProvider.getInstance().reloadConfigAggregators();
    console.log('workspaceContextUtil.ts handleCliConfigChange() - 1');
    StateAggregator.clearInstance();
    console.log('workspaceContextUtil.ts handleCliConfigChange() - 2');

    const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();
    console.log('workspaceContextUtil.ts handleCliConfigChange() - 3');
    if (targetOrgOrAlias) {
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 4');
      this._username = await ConfigUtil.getUsernameFor(targetOrgOrAlias);
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 5');
      this._alias = targetOrgOrAlias !== this._username ? targetOrgOrAlias : undefined;
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 6');
      try {
        console.log('workspaceContextUtil.ts handleCliConfigChange() - 7');
        const connection = await this.getConnection();
        console.log('workspaceContextUtil.ts handleCliConfigChange() - 8');
        this._orgId = connection?.getAuthInfoFields().orgId;
        console.log('workspaceContextUtil.ts handleCliConfigChange() - 9');
      } catch (error: unknown) {
        console.log('workspaceContextUtil.ts handleCliConfigChange() - 10');
        this._orgId = '';
        console.log('workspaceContextUtil.ts handleCliConfigChange() - 11');
        if (error instanceof Error) {
          console.log('workspaceContextUtil.ts handleCliConfigChange() - 12');
          console.log('There was an problem getting the orgId of the default org: ', error);
          console.log('workspaceContextUtil.ts handleCliConfigChange() - 13');
          TelemetryService.getInstance().sendException(
            WORKSPACE_CONTEXT_ORG_ID_ERROR,
            `name: ${error.name}, message: ${error.message}`
          );
          console.log('workspaceContextUtil.ts handleCliConfigChange() - 14');
        }
        console.log('workspaceContextUtil.ts handleCliConfigChange() - 15');
      }
    } else {
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 16');
      this._username = undefined;
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 17');
      this._alias = undefined;
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 18');
      this._orgId = undefined;
      console.log('workspaceContextUtil.ts handleCliConfigChange() - 19');
    }
    console.log('workspaceContextUtil.ts handleCliConfigChange() - 20');

    this.onOrgChangeEmitter.fire({
      username: this._username,
      alias: this._alias
    });
    console.log('workspaceContextUtil.ts - exit handleCliConfigChange()');
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
