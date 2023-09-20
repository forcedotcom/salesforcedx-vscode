/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';

import { DEFAULT_ALIAS } from './authParamsGatherer';

import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

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
import {
  ForceAuthDemoModeExecutor,
  OrgLoginWebContainerExecutor
} from './orgLoginWeb';

export class OrgLoginWebDevHubContainerExecutor extends OrgLoginWebContainerExecutor {
  public build(data: AuthDevHubParams): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('org_login_web_authorize_dev_hub_text')
    );

    command
      .withArg(CLI.ORG_LOGIN_DEVICE)
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub')
      .withLogName('force_auth_device_dev_hub')
      .withJson();

    return command.build();
  }
}

export class OrgLoginWebDevHubExecutor extends SfdxCommandletExecutor<{}> {
  protected showChannelOutput = false;

  public build(data: AuthDevHubParams): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('org_login_web_authorize_dev_hub_text')
    );

    command
      .withArg(CLI.ORG_LOGIN_WEB)
      .withLogName('force_auth_dev_hub')
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub');
    return command.build();
  }
}

export class OrgLoginWebDevHubDemoModeExecutor extends ForceAuthDemoModeExecutor<{}> {
  public build(data: AuthDevHubParams): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('org_login_web_authorize_dev_hub_text'))
      .withArg(CLI.ORG_LOGIN_WEB)
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub')
      .withArg('--no-prompt')
      .withJson()
      .withLogName('force_auth_dev_hub_demo_mode')
      .build();
  }
}

export class AuthDevHubParamsGatherer
  implements ParametersGatherer<AuthDevHubParams> {
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
  switch (true) {
    case isSFContainerMode():
      return new OrgLoginWebDevHubContainerExecutor();
    case isDemoMode():
      return new OrgLoginWebDevHubDemoModeExecutor();
    default:
      return new OrgLoginWebDevHubExecutor();
  }
}

export async function orgLoginWebDevHub() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createAuthDevHubExecutor()
  );
  await commandlet.run();
}
