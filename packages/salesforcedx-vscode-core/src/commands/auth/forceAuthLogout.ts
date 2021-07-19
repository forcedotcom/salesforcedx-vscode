/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { CancellationToken, Progress } from 'vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import { forceConfigSet } from '../forceConfigSet';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  SimpleGatherer
} from '../util';
import { ScratchOrgLogoutParamsGatherer } from './authParamsGatherer';

export class ForceAuthLogoutAll extends SfdxCommandletExecutor<{}> {
  public static withoutShowingChannel(): ForceAuthLogoutAll {
    const instance = new ForceAuthLogoutAll();
    instance.showChannelOutput = false;
    return instance;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_logout_all_text'))
      .withArg('force:auth:logout')
      .withArg('--all')
      .withArg('--noprompt')
      .withLogName('force_auth_logout')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new ForceAuthLogoutAll();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceAuthLogoutAll() {
  await commandlet.run();
}

export class AuthLogoutDefault extends LibraryCommandletExecutor<string> {
  constructor() {
    super(
      nls.localize('force_auth_logout_default_text'),
      'force_auth_logout_default',
      OUTPUT_CHANNEL
    );
  }

  public async run(
    response: ContinueResponse<string>,
    progress?: Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: CancellationToken
  ): Promise<boolean> {
    try {
      await removeUsername(response.data);
    } catch (e) {
      telemetryService.sendException(e.name, e.message);
      return false;
    }
    return true;
  }
}

export async function forceAuthLogoutDefault() {
  const { username, isScratch, error } = await resolveDefaultUsername();
  if (error) {
    telemetryService.sendException(error.name, error.message);
    notificationService.showErrorMessage('Logout failed to run');
  } else if (username) {
    const logoutCommandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      isScratch
        ? new ScratchOrgLogoutParamsGatherer(username)
        : new SimpleGatherer<string>(username),
      new AuthLogoutDefault()
    );
    await logoutCommandlet.run();
  } else {
    notificationService.showInformationMessage(
      nls.localize('auth_logout_no_default_org')
    );
  }
}

async function removeUsername(username: string) {
  await forceConfigSet('');
  const authRemover = await AuthRemover.create();
  await authRemover.removeAuth(username);
}

async function resolveDefaultUsername(): Promise<{
  username?: string;
  isScratch: boolean;
  error?: Error;
}> {
  const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
  if (usernameOrAlias) {
    const username = await OrgAuthInfo.getUsername(usernameOrAlias);
    let isScratch = false;

    try {
      isScratch = await OrgAuthInfo.isAScratchOrg(username);
    } catch (err) {
      return { error: err, isScratch: false };
    }
    return { username, isScratch };
  }
  return { isScratch: false };
}
