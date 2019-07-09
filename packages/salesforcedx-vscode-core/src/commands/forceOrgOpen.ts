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

type CLIOrgData = {
  status: number;
  result: {
    orgId: string;
    url: string;
    username: string;
  };
};

class ForceOrgOpenExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_org_open_default_scratch_org_text'))
      .withArg('force:org:open')
      .withLogName('force_org_open_default_scratch_org');
    if (isSFDXContainerMode()) {
      builder.withArg('--urlonly').withJson();
    }
    return builder.build();
  }

  private buildUserMessageWith(orgData: CLIOrgData): string {
    return nls.localize(
      'force_org_open_container_mode_message_text',
      orgData.result.orgId,
      orgData.result.username,
      orgData.result.url
    );
  }

  private openBrowserWithCliResponse(cliResponseJSON: string | Buffer) {
    try {
      const cliOrgData: CLIOrgData = JSON.parse(cliResponseJSON.toString());
      const authenticatedOrgUrl: string = cliOrgData.result.url;

      channelService.appendLine(this.buildUserMessageWith(cliOrgData));

      if (authenticatedOrgUrl) {
        vscode.env.openExternal(vscode.Uri.parse(authenticatedOrgUrl));
      }
    } catch (e) {
      telemetryService.sendErrorEvent(e.message, e.stack);
    }
  }

  public execute(response: ContinueResponse<string>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    if (isSFDXContainerMode()) {
      channelService.showChannelOutput();
      channelService.streamCommandStartStop(execution);

      execution.stdoutSubject.subscribe(cliResponseJSON =>
        this.openBrowserWithCliResponse(cliResponseJSON)
      );
    } else {
      this.attachExecution(
        execution,
        cancellationTokenSource,
        cancellationToken
      );
    }
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new ForceOrgOpenExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceOrgOpen() {
  await commandlet.run();
}
