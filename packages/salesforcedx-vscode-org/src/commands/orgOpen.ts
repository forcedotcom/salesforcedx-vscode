/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CliCommandExecutor,
  ContinueResponse,
  EmptyParametersGatherer,
  isSFContainerMode,
  OrgOpenContainerResultParser,
  OrgOpenErrorResult,
  OrgOpenSuccessResult,
  ProgressNotification,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker,
  TimingUtils,
  notificationService,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { channelService } from '../channels';
import { nls } from '../messages';
import { TelemetryService } from '../telemetry';

// Get core API services at runtime
const getCoreApi = () => {
  const coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');
  return coreExtension?.exports;
};

const getTaskViewService = () => getCoreApi()?.taskViewService;

class OrgOpenContainerExecutor extends SfCommandletExecutor<{}> {
  public build(_data: {}): Command {
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
    const startTime = TimingUtils.getCurrentTime();
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
          // remove when we drop CLI invocations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const cliOrgData = orgOpenParser.getResult() as OrgOpenSuccessResult;
          const authenticatedOrgUrl: string = cliOrgData.result.url;

          channelService.appendLine(this.buildUserMessageWith(cliOrgData));
          // open the default browser
          vscode.env.openExternal(URI.parse(authenticatedOrgUrl));
        } else {
          // remove when we drop CLI invocations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const errorResponse = orgOpenParser.getResult() as OrgOpenErrorResult;
          channelService.appendLine(errorResponse.message);
        }
      } catch (error) {
        channelService.appendLine(nls.localize('org_open_default_scratch_org_container_error'));
        TelemetryService.getInstance().sendException(
          'org_open_container',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `There was an error when parsing the org open response ${error}`
        );
      }
    });

    notificationService.reportCommandExecutionStatus(execution, channelService, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
    getTaskViewService()?.addCommandExecution(execution, cancellationTokenSource);
  }
}
class OrgOpenExecutor extends SfCommandletExecutor<{}> {
  protected showChannelOutput = false;

  public build(_data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_open_default_scratch_org_text'))
      .withArg('org:open')
      .withLogName('org_open_default_scratch_org')
      .build();
  }
}

const getExecutor = (): SfCommandletExecutor<{}> =>
  isSFContainerMode() ? new OrgOpenContainerExecutor() : new OrgOpenExecutor();

export const orgOpen = (): void => {
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new EmptyParametersGatherer(), getExecutor());
  void commandlet.run();
};
