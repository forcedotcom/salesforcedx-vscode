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
import { nls } from '../messages';
import { getRootWorkspacePath } from '../util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

interface CLIOrgData {
  status: number;
  result: {
    orgId: string;
    url: string;
    username: string;
  };
}

class ForceOrgOpenExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_org_open_default_scratch_org_text'))
      .withArg('force:org:open')
      .withLogName('force_org_open_default_scratch_org');
    if (process.env.SFDX_CONTAINER_MODE) {
      builder.withArg('-r').withJson();
    }
    return builder.build();
  }

  public execute(response: ContinueResponse<string>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    if (process.env.SFDX_CONTAINER_MODE) {
      execution.stdoutSubject.subscribe(cliResponseJSON => {
        try {
          const cliOrgData: CLIOrgData = JSON.parse(cliResponseJSON.toString());
          const authenticatedOrgUrl: string = cliOrgData.result.url;
          console.log('\nCLI DATA==> ', cliOrgData);
          console.log('\nURL==>', authenticatedOrgUrl);
          if (authenticatedOrgUrl) {
            vscode.env.openExternal(vscode.Uri.parse(authenticatedOrgUrl));
          }
        } catch (error) {
          console.error(error);
        }
      });
    }
  }
}

console.log('\nActivation CONTAINER MODE==>', process.env.SFDX_CONTAINER_MODE);

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new ForceOrgOpenExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceOrgOpen() {
  console.log(
    '\nforceOrgOpen CONTAINER MODE==>',
    process.env.SFDX_CONTAINER_MODE
  );
  await commandlet.run();
}
