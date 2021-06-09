/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { Observable } from 'rxjs/Observable';
import { CancellationTokenSource } from 'vscode';
import { channelService } from '../../channels/index';
import { nls } from '../../messages';
import { isDemoMode, isProdOrg } from '../../modes/demo-mode';
import {
  notificationService,
  ProgressNotification
} from '../../notifications/index';
import { taskViewService } from '../../statuses/index';
import { getRootWorkspacePath, isSFDXContainerMode } from '../../util';
import {
  DemoModePromptGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';
import { ForceAuthLogoutAll } from './forceAuthLogout';

import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';

export class ForceAuthWebLoginExecutor extends SfdxCommandletExecutor<
  AuthParams
> {
  protected showChannelOutput = isSFDXContainerMode();

  public build(data: AuthParams): Command {
    const command = new SfdxCommandBuilder().withDescription(
      nls.localize('force_auth_web_login_authorize_org_text')
    );
    if (isSFDXContainerMode()) {
      command
        .withArg('force:auth:device:login')
        .withLogName('force_auth_device_login');
    } else {
      command
        .withArg('force:auth:web:login')
        .withLogName('force_auth_web_login');
    }
    command
      .withFlag('--setalias', data.alias)
      .withFlag('--instanceurl', data.loginUrl)
      .withArg('--setdefaultusername');
    return command.build();
  }
}

export abstract class ForceAuthDemoModeExecutor<
  T
> extends SfdxCommandletExecutor<T> {
  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
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

export class ForceAuthWebLoginDemoModeExecutor extends ForceAuthDemoModeExecutor<
  AuthParams
> {
  public build(data: AuthParams): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_web_login_authorize_org_text'))
      .withArg('force:auth:web:login')
      .withFlag('--setalias', data.alias)
      .withFlag('--instanceurl', data.loginUrl)
      .withArg('--setdefaultusername')
      .withArg('--noprompt')
      .withJson()
      .withLogName('force_auth_web_login_demo_mode')
      .build();
  }
}

export async function promptLogOutForProdOrg() {
  await new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new DemoModePromptGatherer(),
    ForceAuthLogoutAll.withoutShowingChannel()
  ).run();
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new AuthParamsGatherer();

export function createAuthWebLoginExecutor(): SfdxCommandletExecutor<{}> {
  return isDemoMode()
    ? new ForceAuthWebLoginDemoModeExecutor()
    : new ForceAuthWebLoginExecutor();
}

export async function forceAuthWebLogin() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createAuthWebLoginExecutor()
  );
  await commandlet.run();
}
