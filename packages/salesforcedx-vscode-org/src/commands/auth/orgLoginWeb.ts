/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  SfWorkspaceChecker,
  SfCommandlet,
  SfCommandletExecutor,
  CliCommandExecutor,
  TimingUtils,
  workspaceUtils,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode';
import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { ORG_LOGIN_WEB } from '../../constants';
import { nls } from '../../messages';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';

export const generateVerificationCode = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex').slice(0, 4);

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

  public execute(response: ContinueResponse<AuthParams>): void {
    const startTime = TimingUtils.getCurrentTime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    const codeBuilderState = process.env.CODE_BUILDER_STATE;
    if (codeBuilderState) {
      const code = generateVerificationCode(codeBuilderState);
      void vscode.window.showInformationMessage(
        nls.localize('org_login_web_verification_code_message', code)
      );
    }

    // old rxjs doesn't like async functions in subscribe, but we use them and they seem to work.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      // Node child_process 'exit' emits (code, signal); RxJS fromEvent passes multiple args as an array
      const exitCode = Array.isArray(data) ? data[0] : data;
      if (exitCode === 0) {
        await updateConfigAndStateAggregators();
      }
    });
  }
}

export const orgLoginWeb = async (instanceUrl: string): Promise<void> => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new AuthParamsGatherer(instanceUrl),
    new OrgLoginWebExecutor()
  );
  await commandlet.run();
};
