/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import { ForceAuthDemoModeExecutor } from './forceAuthWebLogin';

import { nls } from '../messages';
import { isDemoMode } from '../modes/demo-mode';

import * as vscode from 'vscode';

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder,
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

import {
  ContinueResponse,
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';

import { getRootWorkspacePath, withoutQuotes, defaultDevHubUserNameKey } from '../util';
import { ConfigSource, ConfigUtil } from '../util/index';
import { isNullOrUndefined } from 'util';
import { ConfigFile } from '@salesforce/core';

export class ForceAuthDevHubExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      )
      .withArg('force:auth:web:login')
      .withArg('--setdefaultdevhubusername')
      .withLogName('force_auth_dev_hub')
      .build();
  }

  public async execute(response: ContinueResponse<any>): Promise<void> {

    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async () => {

      const globalDevHubName = await this.getDevNubHame(ConfigSource.Global);
      if (isNullOrUndefined(globalDevHubName)) {

        const localDevHubName = await this.getDevNubHame(ConfigSource.Local);
        if (isNullOrUndefined(localDevHubName) === false) {
          this.setGlobal(String(localDevHubName));
        }
      }

    });

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  private async setGlobal(newUsername: string) {

    const homeDirectory = require('os').homedir();
    const configFileName = 'sfdx-config.json';

    const globalConfig = await ConfigFile.create({
      isGlobal: true,
      rootFolder: homeDirectory,
      filename: configFileName
    });

    globalConfig.set(defaultDevHubUserNameKey, newUsername);
    await globalConfig.write();
  }

  public async getDevNubHame(source: ConfigSource.Global | ConfigSource.Local) {

    const configValue = await ConfigUtil.getConfigValue(defaultDevHubUserNameKey, source);

    if (isNullOrUndefined(configValue)) {
      return undefined;
    }

    const devHubName = withoutQuotes(configValue);
    return devHubName;
  }

}

export class ForceAuthDevHubDemoModeExecutor extends ForceAuthDemoModeExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      )
      .withArg('force:auth:web:login')
      .withArg('--setdefaultdevhubusername')
      .withArg('--noprompt')
      .withJson()
      .withLogName('force_auth_dev_hub_demo_mode')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export function createExecutor(): SfdxCommandletExecutor<{}> {
  return isDemoMode()
    ? new ForceAuthDevHubDemoModeExecutor()
    : new ForceAuthDevHubExecutor();
}

export async function forceAuthDevHub() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createExecutor()
  );
  await commandlet.run();
}
