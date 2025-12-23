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
  SfWorkspaceChecker,
  SfCommandlet,
  SfCommandletExecutor,
  CliCommandExecutor,
  TimingUtils,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { ORG_LOGIN_WEB } from '../../constants';
import { nls } from '../../messages';
import { updateConfigAndStateAggregators } from '../../util';
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

  public execute(response: ContinueResponse<AuthDevHubParams>): void {
    const startTime = TimingUtils.getCurrentTime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    // old rxjs doesn't like async functions in subscribe, but we use them and they seem to work.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    execution.processExitSubject.subscribe(async exitCode => {
      this.logMetric(execution.command.logName, startTime);
      // Only update state aggregators on successful completion (exit code 0)
      if (exitCode === 0) {
        await updateConfigAndStateAggregators();
      }
    });
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
