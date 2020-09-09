/*
 * Copyright (c) 2020, salesforce.com, inc.
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
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

import { Uri } from 'vscode';
import { FunctionService } from './functionService';

export class ForceFunctionStart extends SfdxCommandletExecutor<string> {
  public build(sourceFsPath: string): Command {
    this.executionCwd = sourceFsPath;
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_function_start_text'))
      .withArg('evergreen:function:start')
      .withArg('--verbose')
      .withLogName('force_function_start')
      .build();
  }

  public execute(response: ContinueResponse<string>) {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    const executionName = execution.command.toString();

    FunctionService.instance.registerStartedFunction({
      terminate: () => {
        return execution.killExecution('SIGTERM');
      }
    });

    channelService.streamCommandOutputWithoutColor(execution);
    channelService.showChannelOutput();

    const progress = new Subject();
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      vscode.ProgressLocation.Notification,
      progress.asObservable() as Observable<number>
    );
    const task = taskViewService.addCommandExecution(
      execution,
      cancellationTokenSource
    );

    execution.stdoutSubject.subscribe(data => {
      if (data.toString().includes('Ready to process signals')) {
        progress.complete();
        taskViewService.removeTask(task);
        notificationService
          .showSuccessfulExecution(executionName)
          .catch(() => {});
        this.logMetric(execution.command.logName, startTime);
      }
    });

    execution.processExitSubject.subscribe(async exitCode => {});

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
  }
}

/**
 * Executes sfdx evergreen:function:start --verbose
 * @param sourceUri
 */
export async function forceFunctionStart(sourceUri: Uri) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceFunctionStart()
  );
  await commandlet.run();
}
