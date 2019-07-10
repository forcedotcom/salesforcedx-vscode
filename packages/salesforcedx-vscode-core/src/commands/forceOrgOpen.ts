/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, isSFDXContainerMode } from '../util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

type CliOrgData = {
  status: number;
  result: {
    orgId: string;
    url: string;
    username: string;
  };
};

class ForceOrgOpenContainerExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_org_open_default_scratch_org_text'))
      .withArg('force:org:open')
      .withLogName('force_org_open_default_scratch_org')
      .withArg('--urlonly')
      .withJson()
      .build();
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath(),
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    let stdOut = '';
    execution.stdoutSubject.subscribe(cliResponse => {
      stdOut += cliResponse.toString();
    });

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
      try {
        const cliOrgData: CliOrgData = JSON.parse(stdOut);
        const authenticatedOrgUrl: string = cliOrgData.result.url;

        if (authenticatedOrgUrl) {
          vscode.env.openExternal(vscode.Uri.parse(authenticatedOrgUrl));
        }
      } catch (e) {
        channelService.appendLine(
          nls.localize('force_org_open_default_scratch_org_container_error')
        );
        telemetryService.sendErrorEvent(e.message, e.message);
      }
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }
}

class ForceOrgOpenExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_org_open_default_scratch_org_text'))
      .withArg('force:org:open')
      .withLogName('force_org_open_default_scratch_org')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = isSFDXContainerMode()
  ? new ForceOrgOpenContainerExecutor()
  : new ForceOrgOpenExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceOrgOpen() {
  await commandlet.run();
}
