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
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import { telemetryService } from '../../telemetry';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

import { Uri, window } from 'vscode';
import { FunctionService } from './functionService';

export class ForceFunctionStartExecutor extends SfdxCommandletExecutor<string> {
  public build(functionDirPath: string): Command {
    this.executionCwd = functionDirPath;
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_function_start_text'))
      .withArg('evergreen:function:start')
      .withArg('--verbose')
      .withLogName('force_function_start')
      .build();
  }

  /**
   * Locate the directory that has function.toml
   * @param sourceFsPath path to start function from
   */
  public static getFunctionDir(sourceFsPath: string) {
    let current = fs.lstatSync(sourceFsPath).isDirectory()
      ? sourceFsPath
      : path.dirname(sourceFsPath);
    const { root } = path.parse(sourceFsPath);
    while (current !== root) {
      const tomlPath = path.join(current, 'function.toml');
      if (fs.existsSync(tomlPath)) {
        return current;
      }
      current = path.dirname(current);
    }
    return undefined;
  }

  public execute(response: ContinueResponse<string>) {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const sourceFsPath = response.data;
    const functionDirPath = ForceFunctionStartExecutor.getFunctionDir(
      sourceFsPath
    );
    if (!functionDirPath) {
      notificationService.showWarningMessage(
        nls.localize('force_function_start_warning_no_toml')
      );
      telemetryService.sendException(
        'force_function_start',
        'force_function_start_no_toml'
      );
      return;
    }
    const execution = new CliCommandExecutor(this.build(functionDirPath), {
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
  if (!sourceUri) {
    // Try to start function from current active editor, if running SFDX: start function from command palette
    sourceUri = window.activeTextEditor?.document.uri!;
  }
  if (!sourceUri) {
    notificationService.showWarningMessage(
      nls.localize('force_function_start_warning_not_in_function_folder')
    );
    return;
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceFunctionStartExecutor()
  );
  await commandlet.run();
}
