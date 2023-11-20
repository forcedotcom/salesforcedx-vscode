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
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ContinueResponse,
  isSFContainerMode
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class OrgOpenContainerExecutor extends SfdxCommandletExecutor<{}> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('org_open_default_scratch_org_text'))
      .withArg('org:open')
      .withLogName('force_org_open_default_scratch_org')
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
        channelService.appendLine(
          nls.localize('org_open_default_scratch_org_container_error')
        );
        telemetryService.sendException(
          'force_org_open_container',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `There was an error when parsing the org open response ${error}`
        );
      }
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export class OrgOpenExecutor extends SfdxCommandletExecutor<{}> {
  protected showChannelOutput = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('org_open_default_scratch_org_text'))
      .withArg('org:open')
      .withLogName('force_org_open_default_scratch_org')
      .build();
  }
}

export function getExecutor(): SfdxCommandletExecutor<{}> {
  return isSFContainerMode()
    ? new OrgOpenContainerExecutor()
    : new OrgOpenExecutor();
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function orgOpen() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    getExecutor()
  );
  await commandlet.run();
}
