/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  OrgOpenContainerResultParser,
  OrgOpenErrorResult,
  OrgOpenSuccessResult,
  SfCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse, isSFContainerMode } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { EmptyParametersGatherer, SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from './util';

export class OrgOpenContainerExecutor extends SfCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_open_default_scratch_org_text'))
      .withArg('org:open')
      .withLogName('org_open_default_scratch_org')
      .withArg('--url-only')
      .withJson()
      .build();
  }

  public buildUserMessageWith(orgData: OrgOpenSuccessResult): string {
    return nls.localize(
      'org_open_container_mode_message_text',
      orgData.result.orgId,
      orgData.result.username,
      orgData.result.url
    );
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);

    let stdOut: string = '';
    execution.stdoutSubject.subscribe(cliResponse => {
      stdOut += cliResponse.toString();
    });

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
      try {
        const orgOpenParser = new OrgOpenContainerResultParser(stdOut);

        if (orgOpenParser.openIsSuccessful()) {
          const cliOrgData = orgOpenParser.getResult() as OrgOpenSuccessResult;
          const authenticatedOrgUrl: string = cliOrgData.result.url;

          channelService.appendLine(this.buildUserMessageWith(cliOrgData));
          // open the default browser
          vscode.env.openExternal(vscode.Uri.parse(authenticatedOrgUrl));
        } else {
          const errorResponse = orgOpenParser.getResult() as OrgOpenErrorResult;
          channelService.appendLine(errorResponse.message);
        }
      } catch (error) {
        channelService.appendLine(nls.localize('org_open_default_scratch_org_container_error'));
        telemetryService.sendException(
          'org_open_container',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `There was an error when parsing the org open response ${error}`
        );
      }
    });

    notificationService.reportCommandExecutionStatus(execution, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export class OrgOpenExecutor extends SfCommandletExecutor<{}> {
  protected showChannelOutput = false;

  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_open_default_scratch_org_text'))
      .withArg('org:open')
      .withLogName('org_open_default_scratch_org')
      .build();
  }
}

export const getExecutor = (): SfCommandletExecutor<{}> =>
  isSFContainerMode() ? new OrgOpenContainerExecutor() : new OrgOpenExecutor();

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export const orgOpen = (): void => {
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, getExecutor());
  void commandlet.run();
};
