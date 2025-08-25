/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { ORG_LOGIN_WEB } from '../../constants';
import { nls } from '../../messages';
import { SfCommandlet, SfCommandletExecutor } from '../util';
import { DEFAULT_ALIAS } from './authParamsGatherer';

class OrgLoginWebDevHubExecutor extends SfCommandletExecutor<{}> {
  protected showChannelOutput = false;

  public build(data: AuthDevHubParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_dev_hub_text'));

    command
      .withArg(ORG_LOGIN_WEB)
      .withLogName('org_login_web_dev_hub')
      .withFlag('--alias', data.alias)
      .withArg('--set-default-dev-hub');
    return command.build();
  }
}

class AuthDevHubParamsGatherer implements ParametersGatherer<AuthDevHubParams> {
  public async gather(): Promise<CancelResponse | ContinueResponse<AuthDevHubParams>> {
    const aliasInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    };
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

type AuthDevHubParams = {
  alias: string;
};

export const orgLoginWebDevHub = async () => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new AuthDevHubParamsGatherer(),
    new OrgLoginWebDevHubExecutor()
  );
  await commandlet.run();
};
