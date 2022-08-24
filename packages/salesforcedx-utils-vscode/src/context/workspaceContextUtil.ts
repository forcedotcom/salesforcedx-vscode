/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  AuthInfo,
  ConfigAggregator,
  Connection,
  SfdxConfigAggregator
} from '@salesforce/core';
import { join } from 'path';
import * as vscode from 'vscode';
import { AuthUtil } from '..';
import { nls } from '../messages';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../types';
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
    const cliConfigPath = join(
      getRootWorkspacePath(),
      SFDX_FOLDER,
      SFDX_CONFIG_FILE
    );
    this.cliConfigWatcher = vscode.workspace.createFileSystemWatcher(
      cliConfigPath
    );
    this.cliConfigWatcher.onDidChange(bindedHandler);
    this.cliConfigWatcher.onDidCreate(bindedHandler);
    this.cliConfigWatcher.onDidDelete(bindedHandler);
  }

  public getAuthUtil(): AuthUtil {
    return AuthUtil.getInstance();
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(
      this.cliConfigWatcher,
      this.onOrgChangeEmitter,
      this.cliConfigWatcher
    );
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
    this.reloadConfigAggregators();
    const usernameOrAlias = await this.getAuthUtil().getDefaultUsernameOrAlias(
      false
    );

    if (usernameOrAlias) {
      this._username = await this.getAuthUtil().getUsername(usernameOrAlias);
      this._alias =
        usernameOrAlias !== this._username ? usernameOrAlias : undefined;
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

  private async reloadConfigAggregators() {
    console.log(
      'The .sfdx config file has changed.  Reloading ConfigAggregator values.'
    );

    const sfConfigAggregator = await VSCEConfigAggregator.create();
    await sfConfigAggregator.reload();

    const sfdxConfigAggregator = await VSCEConfigAggregator.create({
      sfdx: true
    });
    await sfdxConfigAggregator.reload();
  }
}

export function getLogDirPath(): string {
  return join(getRootWorkspacePath(), '.sfdx', 'tools', 'debug', 'logs');
}

type VSCEConfigAggregatorOptions = {
  /*
   *  The SfdxConfigAggregator is used only to get configuration
   *  values that correspond with old/deprecated config keys.
   *  Currently, the key used for the custom templates
   *  directory is the only usage, since it is documented for use
   *  here: https://developer.salesforce.com/tools/vscode/en/user-guide/byotemplate#set-default-template-location
   */
  sfdx?: boolean;
  globalValuesOnly?: boolean;
};

/*
 * The VSCEConfigAggregator class is used to abstract away
 * some of the complexities around changing the process directory
 * that are needed to accurately retrieve configuration values
 * when using the ConfigAggregator in the VSCE context.
 */
class VSCEConfigAggregator {
  public static async create(
    options?: VSCEConfigAggregatorOptions
  ): Promise<ConfigAggregator> {
    return VSCEConfigAggregator.getConfigAggregator(options);
  }

  private static async getConfigAggregator(
    options: VSCEConfigAggregatorOptions = {
      sfdx: false,
      globalValuesOnly: false
    }
  ): Promise<ConfigAggregator> {
    let configAggregator;
    const currentWorkingDirectory = process.cwd();
    if (options.globalValuesOnly) {
      VSCEConfigAggregator.ensureProcessIsRunningUnderUserHomeDir(
        currentWorkingDirectory
      );
    } else {
      // Change the current working directory to the project path,
      // so that ConfigAggregator reads the local project values
      VSCEConfigAggregator.ensureProcessIsRunningUnderProjectRoot(
        currentWorkingDirectory
      );
    }
    try {
      configAggregator = options.sfdx
        ? await SfdxConfigAggregator.create()
        : await ConfigAggregator.create();
    } finally {
      // Change the current working directory back to what it was
      // before returning.
      // Wrapping this in a finally block ensures that the working
      // directory is switched back to what it was before this method
      // was called if SfdxConfigAggregator.create() throws an exception.
      process.chdir(currentWorkingDirectory);
    }
    return configAggregator;
  }

  private static ensureProcessIsRunningUnderUserHomeDir(path: string) {
    const userHomePath = '/';
    if (path !== userHomePath) {
      process.chdir(userHomePath);
    }
  }

  private static ensureProcessIsRunningUnderProjectRoot(path: string) {
    const rootWorkspacePath = getRootWorkspacePath();
    if (path !== rootWorkspacePath) {
      process.chdir(rootWorkspacePath);
    }
  }
}
