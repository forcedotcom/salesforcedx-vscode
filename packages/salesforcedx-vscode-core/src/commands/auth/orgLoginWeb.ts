/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode';
import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode';
import {
  ContinueResponse,
  isSFContainerMode
} from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'os';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { CancellationTokenSource } from 'vscode';
import { channelService } from '../../channels/index';
import { CLI } from '../../constants';
import { nls } from '../../messages';
import { isDemoMode, isProdOrg } from '../../modes/demo-mode';
import {
  notificationService,
  ProgressNotification
} from '../../notifications/index';
import { taskViewService } from '../../statuses/index';
import { telemetryService } from '../../telemetry';
import { workspaceUtils } from '../../util';
import {
  DemoModePromptGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';
import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';
import { OrgLogoutAll } from './orgLogout';

export interface DeviceCodeResponse {
  user_code: string;
  device_code: string;
  interval: number;
  verification_uri: string;
}

export class OrgLoginWebContainerExecutor extends SfdxCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;
  protected deviceCodeReceived = false;
  protected stdOut = '';

  public build(data: AuthParams): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('org_login_web_authorize_org_text')
    );

    command
      .withArg(CLI.ORG_LOGIN_DEVICE)
      .withLogName('force_auth_device_login')
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default')
      .withJson();

    return command.build();
  }

  public execute(response: ContinueResponse<AuthParams>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);

    execution.stdoutSubject.subscribe(cliResponse => {
      const responseStr = cliResponse.toString();
      this.handleCliResponse(responseStr);
    });

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );

    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  protected handleCliResponse(response: string) {
    // response may not be complete data, so we accumulate data as it comes in.
    this.stdOut += response;

    if (!this.deviceCodeReceived) {
      const authUrl = this.parseAuthUrlFromStdOut(this.stdOut);

      if (authUrl) {
        this.deviceCodeReceived = true;
        // open the default browser
        vscode.env.openExternal(vscode.Uri.parse(authUrl, true));
      }
    }
  }

  private parseAuthUrlFromStdOut(stdOut: string): string | undefined {
    let authUrl;
    try {
      const response = JSON.parse(stdOut) as DeviceCodeResponse;
      const verificationUrl = response.verification_uri;
      const userCode = response.user_code;

      if (verificationUrl && userCode) {
        authUrl = `${verificationUrl}?user_code=${userCode}&prompt=login`;
        this.logToOutputChannel(userCode, verificationUrl);
      }
    } catch (error) {
      channelService.appendLine(
        nls.localize('org_login_device_code_parse_error')
      );
      telemetryService.sendException(
        'force_auth_web_container',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `There was an error when parsing the cli response ${error}`
      );
    }

    return authUrl;
  }

  private logToOutputChannel(code: string, url: string) {
    channelService.appendLine(`${EOL}`);
    channelService.appendLine(nls.localize('action_required'));
    channelService.appendLine(
      nls.localize('org_login_device_enter_code', code, url)
    );
    channelService.appendLine(`${EOL}`);
  }
}

export class OrgLoginWebExecutor extends SfdxCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;

  public build(data: AuthParams): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('org_login_web_authorize_org_text')
    );

    command
      .withArg(CLI.ORG_LOGIN_WEB)
      .withLogName('force_auth_web_login')
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default');

    return command.build();
  }
}

export abstract class AuthDemoModeExecutor<
  T
> extends SfdxCommandletExecutor<T> {
  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = process.hrtime();
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
      execution.stderrSubject as any as Observable<Error | undefined>
    );

    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    try {
      const result = await new CommandOutput().getCmdResult(execution);
      if (isProdOrg(JSON.parse(result))) {
        await promptLogOutForProdOrg();
      } else {
        await notificationService.showSuccessfulExecution(
          execution.command.toString()
        );
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

export class OrgLoginWebDemoModeExecutor extends AuthDemoModeExecutor<AuthParams> {
  public build(data: AuthParams): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('org_login_web_authorize_org_text'))
      .withArg(CLI.ORG_LOGIN_WEB)
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default')
      .withArg('--no-prompt')
      .withJson()
      .withLogName('force_auth_web_login_demo_mode')
      .build();
  }
}

export async function promptLogOutForProdOrg() {
  await new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new DemoModePromptGatherer(),
    OrgLogoutAll.withoutShowingChannel()
  ).run();
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new AuthParamsGatherer();

export function createOrgLoginWebExecutor(): SfdxCommandletExecutor<{}> {
  switch (true) {
    case isSFContainerMode():
      return new OrgLoginWebContainerExecutor();
    case isDemoMode():
      return new OrgLoginWebDemoModeExecutor();
    default:
      return new OrgLoginWebExecutor();
  }
}

export async function orgLoginWeb() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createOrgLoginWebExecutor()
  );
  await commandlet.run();
}
