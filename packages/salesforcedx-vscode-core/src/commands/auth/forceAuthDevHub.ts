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
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

import { getRootWorkspacePath } from '../../util';

import { ConfigFile, OrgConfigProperties } from '@salesforce/core';
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { homedir } from 'os';
import * as vscode from 'vscode';
import { CLI } from '../../constants';
import { SFDX_CONFIG_FILE } from '../../constants';
import { nls } from '../../messages';
import { isDemoMode } from '../../modes/demo-mode';
import { isSFDXContainerMode } from '../../util';
import { ConfigSource, OrgAuthInfo } from '../../util/index';
import { ForceAuthDemoModeExecutor } from './forceAuthWebLogin';
import { ForceAuthWebLoginContainerExecutor } from './forceAuthWebLogin';

export class ForceAuthDevHubContainerExecutor extends ForceAuthWebLoginContainerExecutor {
  public build(data: {}): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );

    command
      .withArg(CLI.AUTH_DEVICE_LOGIN)
      .withArg('--setdefaultdevhubusername')
      .withLogName('force_auth_device_dev_hub')
      .withJson();

    return command.build();
  }
}

export class ForceAuthDevHubExecutor extends SfdxCommandletExecutor<{}> {
  protected showChannelOutput = false;

  public build(data: {}): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );

    command
      .withArg(CLI.AUTH_WEB_LOGIN)
      .withLogName('force_auth_dev_hub')
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

    globalConfig.set(OrgConfigProperties.TARGET_DEV_HUB, newUsername);
    await globalConfig.write();
  }
}

export class ForceAuthDevHubDemoModeExecutor extends ForceAuthDemoModeExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      )
      .withArg(CLI.AUTH_WEB_LOGIN)
      .withArg('--setdefaultdevhubusername')
      .withArg('--noprompt')
      .withJson()
      .withLogName('force_auth_dev_hub_demo_mode')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export function createAuthDevHubExecutor(): SfdxCommandletExecutor<{}> {
  switch (true) {
    case isSFDXContainerMode():
      return new ForceAuthDevHubContainerExecutor();
    case isDemoMode():
      return new ForceAuthDevHubDemoModeExecutor();
    default:
      return new ForceAuthDevHubExecutor();
  }
}

export async function forceAuthDevHub() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createAuthDevHubExecutor()
  );
  await commandlet.run();
}
