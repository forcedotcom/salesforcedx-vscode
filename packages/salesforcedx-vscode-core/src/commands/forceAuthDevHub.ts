/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

import { getRootWorkspacePath } from '../util';

import { ConfigFile } from '@salesforce/core';
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { CancelResponse,
  ContinueResponse,
  ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { homedir } from 'os';
import * as vscode from 'vscode';
import { DEFAULT_DEV_HUB_USERNAME_KEY, SFDX_CONFIG_FILE } from '../constants';
import { nls } from '../messages';
import { isDemoMode } from '../modes/demo-mode';
import { isSFDXContainerMode } from '../util';
import { ConfigSource, OrgAuthInfo } from '../util/index';
import { ForceAuthDemoModeExecutor } from './forceAuthWebLogin';

export const DEFAULT_ALIAS = 'vscodeOrg';

export class ForceAuthDevHubExecutor extends SfdxCommandletExecutor<{}> {
  protected showChannelOutput = isSFDXContainerMode();

  public build(data: AuthDevHubParams): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
    if (isSFDXContainerMode()) {
      command
        .withArg('force:auth:device:login')
        .withLogName('force_auth_device_dev_hub');
    } else {
      command
        .withArg('force:auth:web:login')
        .withLogName('force_auth_dev_hub');
    }
    command
    .withFlag('--setalias', data.alias)
    .withArg('--setdefaultdevhubusername');
    return command.build();
  }

  public async execute(response: ContinueResponse<any>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(() =>
      this.configureDefaultDevHubLocation()
    );

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  public async configureDefaultDevHubLocation() {
    const globalDevHubName = await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(
      false,
      ConfigSource.Global
    );

    if (isNullOrUndefined(globalDevHubName)) {
      const localDevHubName = await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(
        false,
        ConfigSource.Local
      );

      if (localDevHubName) {
        await this.setGlobalDefaultDevHub(localDevHubName);
      }
    }
  }

  public async setGlobalDefaultDevHub(newUsername: string): Promise<void> {
    const homeDirectory = homedir();

    const globalConfig = await ConfigFile.create({
      isGlobal: true,
      rootFolder: homeDirectory,
      filename: SFDX_CONFIG_FILE
    });

    globalConfig.set(DEFAULT_DEV_HUB_USERNAME_KEY, newUsername);
    await globalConfig.write();
  }
}

export class ForceAuthDevHubDemoModeExecutor extends ForceAuthDemoModeExecutor<{}> {
  public build(data: AuthDevHubParams): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      )
      .withArg('force:auth:web:login')
      .withFlag('--setalias', data.alias)
      .withArg('--setdefaultdevhubusername')
      .withArg('--noprompt')
      .withJson()
      .withLogName('force_auth_dev_hub_demo_mode')
      .build();
  }
}

export class AuthDevHubParamsGatherer implements ParametersGatherer<AuthDevHubParams> {

  public async gather(): Promise<
    CancelResponse | ContinueResponse<AuthDevHubParams>
  > {
    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will default the alias to 'vscodeOrg'
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias || DEFAULT_ALIAS
      }
    };
  }
}

export interface AuthDevHubParams {
  alias: string;
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new AuthDevHubParamsGatherer();

export function createAuthDevHubExecutor(): SfdxCommandletExecutor<{}> {
  return isDemoMode()
    ? new ForceAuthDevHubDemoModeExecutor()
    : new ForceAuthDevHubExecutor();
}

export async function forceAuthDevHub() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createAuthDevHubExecutor()
  );
  await commandlet.run();
}
