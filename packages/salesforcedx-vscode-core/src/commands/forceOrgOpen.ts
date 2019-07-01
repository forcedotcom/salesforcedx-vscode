/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  CliCommandExecutor,
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

    execution.stdoutSubject.subscribe(cliResponsedata => {
      console.log('CLI DATA: ', JSON.parse(cliResponsedata.toString()));
      const orgData = JSON.parse(cliResponsedata.toString()).result;
      console.log('\nURL==>', orgData.result.url);
    });
  }
}

console.log('Activation CONTAINER MODE==>', process.env.SFDX_CONTAINER_MODE);

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
    'forceOrgOpen CONTAINER MODE==>',
    process.env.SFDX_CONTAINER_MODE
  );

  if (process.env.SFDX_CONTAINER_MODE) {
    vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com'));
  }
  await commandlet.run();
}
