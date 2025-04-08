/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import {
  CancelResponse,
  ContinueResponse,
  isSFContainerMode,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { CLI } from '../../constants';
import { nls } from '../../messages';
import { isDemoMode } from '../../modes/demo-mode';
import { SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from '../util';
import { DEFAULT_ALIAS } from './authParamsGatherer';
import { AuthDemoModeExecutor, OrgLoginWebContainerExecutor } from './orgLoginWeb';

export class OrgLoginWebDevHubContainerExecutor extends OrgLoginWebContainerExecutor {
  public build(data: AuthDevHubParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_dev_hub_text'));

    command
      .withArg(CLI.ORG_LOGIN_DEVICE)
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub')
      .withLogName('org_login_web_dev_hub_container')
      .withJson();

    return command.build();
  }
}

export class OrgLoginWebDevHubExecutor extends SfCommandletExecutor<{}> {
  protected showChannelOutput = false;

  public build(data: AuthDevHubParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_dev_hub_text'));

    command
      .withArg(CLI.ORG_LOGIN_WEB)
      .withLogName('org_login_web_dev_hub')
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub');
    return command.build();
  }
}

export class OrgLoginWebDevHubDemoModeExecutor extends AuthDemoModeExecutor<{}> {
  public build(data: AuthDevHubParams): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_login_web_authorize_dev_hub_text'))
      .withArg(CLI.ORG_LOGIN_WEB)
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub')
      .withArg('--no-prompt')
      .withJson()
      .withLogName('org_login_web_dev_hub_demo_mode')
      .build();
  }
}

export class AuthDevHubParamsGatherer implements ParametersGatherer<AuthDevHubParams> {
  public async gather(): Promise<CancelResponse | ContinueResponse<AuthDevHubParams>> {
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

export type AuthDevHubParams = {
  alias: string;
};

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new AuthDevHubParamsGatherer();

export const createAuthDevHubExecutor = (): SfCommandletExecutor<{}> => {
  switch (true) {
    case isSFContainerMode():
      return new OrgLoginWebDevHubContainerExecutor();
    case isDemoMode():
      return new OrgLoginWebDevHubDemoModeExecutor();
    default:
      return new OrgLoginWebDevHubExecutor();
  }
};

export const orgLoginWebDevHub = async () => {
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, createAuthDevHubExecutor());
  await commandlet.run();
};
