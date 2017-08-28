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
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  ContinueResponse,
  CreateApexTempFile,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  TempFile
} from './commands';

class ForceApexExecuteExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: TempFile): Command {
    console.log('aaa');
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_execute_text'))
      .withArg('force:apex:execute')
      .withFlag('--apexcodefile', data.fileName)
      .build();
  }
  public execute(response: ContinueResponse<TempFile>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      fs.unlink(response.data.fileName);
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new CreateApexTempFile();

export async function forceApexExecute(explorerDir?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    fileNameGatherer,
    new ForceApexExecuteExecutor()
  );
  commandlet.run();
}
