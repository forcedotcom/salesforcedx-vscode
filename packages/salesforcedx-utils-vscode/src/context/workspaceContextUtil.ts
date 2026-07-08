/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, StateAggregator } from '@salesforce/core';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { ConfigUtil } from '../config/configUtil';
import { projectPaths } from '../helpers/paths';
import { nls } from '../messages/messages';
import { ConfigAggregatorProvider } from '../providers/configAggregatorProvider';
import { TelemetryService } from '../services/telemetry';

export type OrgUserInfo = {
  username?: string;
  alias?: string;
};

export type OrgShape = 'Scratch' | 'Sandbox' | 'Production' | 'Undefined';
export const WORKSPACE_CONTEXT_ORG_ID_ERROR = 'workspace_context_org_id_error';

/**
 * Delegates to the services extension's ConnectionService.getConnection, which validates the token
 * (prompting + dispatching sf.org.login.web on an expired session-ID flow) before returning. The reauth
 * coordination (one-modal-per-connection dedup) lives in ConnectionService.
 */
const getValidatedConnection = Effect.fn('WorkspaceContextUtil.getConnection')(function* () {
  const api = yield* getServicesApi;
  const prebuilt = Layer.succeedContext(api.services.prebuiltServicesDependencies);
  return yield* api.services.ConnectionService.getConnection().pipe(Effect.provide(prebuilt));
});

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContextUtil {
  protected static instance?: WorkspaceContextUtil;

  protected cliConfigWatcher: vscode.FileSystemWatcher;
  protected onOrgChangeEmitter: vscode.EventEmitter<OrgUserInfo>;
  protected _username?: string;
  protected _alias?: string;
  protected _orgId?: string;
  protected _orgShape?: OrgShape;
  protected _devHubId?: string;
  protected _orgEdition?: string;

  public readonly onOrgChange: vscode.Event<OrgUserInfo>;

  protected constructor() {
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

  /**
   * @deprecated Consume ConnectionService from the Services extension directly. This thin facade delegates
   * to it (connection cache + access-token reauth) and is kept for backward compatibility with 2PP consumers.
   */
  public async getConnection(): Promise<Connection> {
    if (!this._username) {
      throw new Error(nls.localize('error_no_target_org'));
    }
    return Effect.runPromise(getValidatedConnection());
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
        const authFields = connection?.getAuthInfoFields();
        this._orgId = authFields?.orgId;
        this._orgEdition = authFields?.orgEdition;
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
      this._orgEdition = undefined;
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

  public get orgEdition(): string | undefined {
    return this._orgEdition;
  }

  public set orgEdition(edition: string | undefined) {
    this._orgEdition = edition;
  }
}
