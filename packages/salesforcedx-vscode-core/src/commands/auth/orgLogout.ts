/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core-bundle';
import {
  Command,
  ConfigUtil,
  ContinueResponse,
  LibraryCommandletExecutor,
  notificationService,
  SfCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { CancellationToken, Progress } from 'vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import {
  EmptyParametersGatherer,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker,
  SimpleGatherer
} from '../util';
import { ScratchOrgLogoutParamsGatherer } from './authParamsGatherer';

export class OrgLogoutAll extends SfCommandletExecutor<{}> {
  public static withoutShowingChannel(): OrgLogoutAll {
    const instance = new OrgLogoutAll();
    instance.showChannelOutput = false;
    return instance;
  }

  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_logout_all_text'))
      .withArg('org:logout')
      .withArg('--all')
      .withArg('--no-prompt')
      .withLogName('org_logout')
      .build();
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new OrgLogoutAll();
const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);

export const orgLogoutAll = async () => {
  await commandlet.run();
};

export class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  constructor() {
    super(nls.localize('org_logout_default_text'), 'org_logout_default', OUTPUT_CHANNEL);
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
      telemetryService.sendException('org_logout_default', `Error: name = ${e.name} message = ${e.message}`);
      return false;
    }
    return true;
  }
}

export const orgLogoutDefault = async () => {
  const { username, isScratch, alias, error } = await resolveTargetOrg();
  if (error) {
    telemetryService.sendException('org_logout_default', error.message);
    void notificationService.showErrorMessage('Logout failed to run');
  } else if (username) {
    // confirm logout for scratch orgs due to special considerations:
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
    const logoutCommandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      isScratch ? new ScratchOrgLogoutParamsGatherer(username, alias) : new SimpleGatherer<string>(username),
      new OrgLogoutDefault()
    );
    await logoutCommandlet.run();
  } else {
    void notificationService.showInformationMessage(nls.localize('org_logout_no_default_org'));
  }
};

const removeUsername = async (username: string) => {
  await ConfigUtil.unsetTargetOrg();
  const authRemover = await AuthRemover.create();
  await authRemover.removeAuth(username);
};

const resolveTargetOrg = async (): Promise<{
  username?: string;
  isScratch: boolean;
  alias?: string;
  error?: Error;
}> => {
  const usernameOrAlias = await OrgAuthInfo.getTargetOrgOrAlias(false);
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
};
