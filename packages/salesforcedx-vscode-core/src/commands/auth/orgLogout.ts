/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import {
  Command,
  notificationService,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
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

export class OrgLogoutAll extends SfdxCommandletExecutor<{}> {
  public static withoutShowingChannel(): OrgLogoutAll {
    const instance = new OrgLogoutAll();
    instance.showChannelOutput = false;
    return instance;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('org_logout_all_text'))
      .withArg('org:logout')
      .withArg('--all')
      .withArg('--no-prompt')
      .withLogName('force_auth_logout')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new OrgLogoutAll();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function orgLogoutAll() {
  await commandlet.run();
}

export class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  constructor() {
    super(
      nls.localize('org_logout_default_text'),
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

export async function orgLogoutDefault() {
  const { username, isScratch, alias, error } = await resolveDefaultUsername();
  if (error) {
    telemetryService.sendException(error.name, error.message);
    notificationService.showErrorMessage('Logout failed to run');
  } else if (username) {
    // confirm logout for scratch orgs due to special considerations:
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
    const logoutCommandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      isScratch
        ? new ScratchOrgLogoutParamsGatherer(username, alias)
        : new SimpleGatherer<string>(username),
      new OrgLogoutDefault()
    );
    await logoutCommandlet.run();
  } else {
    notificationService.showInformationMessage(
      nls.localize('org_logout_no_default_org')
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
  alias?: string;
  error?: Error;
}> {
  const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
  if (usernameOrAlias) {
    const username = await OrgAuthInfo.getUsername(usernameOrAlias);
    const alias = username !== usernameOrAlias ? usernameOrAlias : undefined;
    let isScratch = false;

    try {
      isScratch = await OrgAuthInfo.isAScratchOrg(username);
    } catch (err) {
      return { error: err as Error, isScratch: false };
    }
    return { username, isScratch, alias };
  }
  return { isScratch: false };
}
