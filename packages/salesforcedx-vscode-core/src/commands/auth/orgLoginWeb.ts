/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  workspaceUtils,
  CliCommandExecutor,
  ContinueResponse,
  ProgressNotification,
  SfWorkspaceChecker,
  TimingUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { Observable } from 'rxjs/Observable';
import { CancellationTokenSource } from 'vscode';
import { channelService } from '../../channels/index';
import { CLI } from '../../constants';
import { nls } from '../../messages';
import { isDemoMode, isProdOrg } from '../../modes/demoMode';
import { notificationService } from '../../notifications/index';
import { taskViewService } from '../../statuses/index';
import { DemoModePromptGatherer, SfCommandlet, SfCommandletExecutor } from '../util';
import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';
import { OrgLogoutAll } from './orgLogout';

class OrgLoginWebExecutor extends SfCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;

  public build(data: AuthParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_org_text'));

    command
      .withArg(CLI.ORG_LOGIN_WEB)
      .withLogName('org_login_web')
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default');

    return command.build();
  }
}

export abstract class AuthDemoModeExecutor<T> extends SfCommandletExecutor<T> {
  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = TimingUtils.getCurrentTime();
    const cancellationTokenSource = new CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      // TODO: fix when we update rxjs
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      execution.stderrSubject as any as Observable<Error | undefined>
    );

    channelService.streamCommandOutput(execution);
    void ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    const result = await new CommandOutput().getCmdResult(execution);
    if (isProdOrg(JSON.parse(result))) {
      await promptLogOutForProdOrg();
    } else {
      await notificationService.showSuccessfulExecution(execution.command.toString());
    }
  }
}

class OrgLoginWebDemoModeExecutor extends AuthDemoModeExecutor<AuthParams> {
  public build(data: AuthParams): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_login_web_authorize_org_text'))
      .withArg(CLI.ORG_LOGIN_WEB)
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default')
      .withArg('--no-prompt')
      .withJson()
      .withLogName('org_login_web_demo_mode')
      .build();
  }
}

const promptLogOutForProdOrg = async () => {
  await new SfCommandlet(
    new SfWorkspaceChecker(),
    new DemoModePromptGatherer(),
    OrgLogoutAll.withoutShowingChannel()
  ).run();
};

const createOrgLoginWebExecutor = (): SfCommandletExecutor<{}> =>
  isDemoMode() ? new OrgLoginWebDemoModeExecutor() : new OrgLoginWebExecutor();

export const orgLoginWeb = async (): Promise<void> => {
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new AuthParamsGatherer(), createOrgLoginWebExecutor());
  await commandlet.run();
};
