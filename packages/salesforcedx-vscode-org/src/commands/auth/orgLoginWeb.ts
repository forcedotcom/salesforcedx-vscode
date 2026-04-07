/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  ChannelService,
  CliCommandExecutor,
  ContinueResponse,
  ProgressNotification,
  SfCommandlet,
  SfCommandletExecutor,
  TimingUtils,
  notificationService,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { ORG_LOGIN_WEB } from '../../constants';
import { nls } from '../../messages';
import { getPortKillInstructions, isAuthPortConflictError } from '../../util/authErrorParser';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { getVerificationCodeDescription, showVerificationCodeIfNeeded } from '../../util/verificationCode';
import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';

class OrgLoginWebExecutor extends SfCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;

  constructor() {
    super(OUTPUT_CHANNEL);
  }

  public build(data: AuthParams): Command {
    const command = new SfCommandBuilder().withDescription(
      getVerificationCodeDescription(nls.localize('org_login_web_authorize_org_text'))
    );

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

    const channelService = new ChannelService(OUTPUT_CHANNEL);
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);

    let stderrOutput = '';
    let hasHandledFailure = false;

    const showPortConflictError = async () => {
      const message = `${nls.localize('org_login_web_port_conflict_notification_message')}\n\n${getPortKillInstructions()}`;
      const showOutputText = nls.localize('org_login_web_show_output_button_text');
      const selection = await notificationService.showErrorMessage(message, showOutputText);
      if (selection === showOutputText) {
        channelService.showChannelOutput();
      }
    };

    const showFailure = async (errorOutput: string) => {
      if (hasHandledFailure) {
        return;
      }
      hasHandledFailure = true;
      if (isAuthPortConflictError(errorOutput)) {
        await showPortConflictError();
      } else {
        notificationService.showFailedExecution(execution.command.toString(), channelService);
      }
    };

    execution.stderrSubject.subscribe(data => {
      stderrOutput += data.toString();
    });

    execution.processErrorSubject.subscribe(data => {
      void showFailure(data?.message ?? stderrOutput);
    });

    cancellationToken.onCancellationRequested(() => {
      notificationService.showCanceledExecution(execution.command.toString(), channelService);
    });

    void showVerificationCodeIfNeeded();

    // old rxjs doesn't like async functions in subscribe, but we use them and they seem to work.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      // Node child_process 'exit' emits (code, signal); RxJS fromEvent passes multiple args as an array
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const exitCode = Array.isArray(data) ? data[0] : data;
      if (exitCode === 0) {
        await notificationService.showSuccessfulExecution(execution.command.toString(), channelService);
        await updateConfigAndStateAggregators();
      } else {
        await showFailure(stderrOutput);
      }
    });
  }
}

export const orgLoginWeb = async (instanceUrl?: string, reauthAliasOrUsername?: string): Promise<void> => {
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new AuthParamsGatherer(instanceUrl, reauthAliasOrUsername),
    new OrgLoginWebExecutor()
  );
  await commandlet.run();
};
