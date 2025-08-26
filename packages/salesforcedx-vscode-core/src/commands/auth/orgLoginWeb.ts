/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { SfWorkspaceChecker } from '@salesforce/salesforcedx-utils-vscode';
import { ORG_LOGIN_WEB } from '../../constants';
import { nls } from '../../messages';
import { SfCommandlet, SfCommandletExecutor } from '../util';
import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';

class OrgLoginWebExecutor extends SfCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;

  public build(data: AuthParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_org_text'));

    command
      .withArg(ORG_LOGIN_WEB)
      .withLogName('org_login_web')
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default');

    return command.build();
  }
}

export const orgLoginWeb = async (): Promise<void> => {
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new AuthParamsGatherer(), new OrgLoginWebExecutor());
  await commandlet.run();
};
