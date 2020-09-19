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
import { getRootWorkspacePath } from '../../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

import { Uri, window } from 'vscode';
import { FunctionService } from './functionService';

/**
 * Error types when running SFDX: Start Function
 * This is also used as the telemetry log name.
 */
type ForceFunctionStartErrorType =
  | 'force_function_start_plugin_not_installed'
  | 'force_function_start_docker_plugin_not_installed_or_started';

const forceFunctionStartErrorInfo: {
  [key in ForceFunctionStartErrorType]: {
    cliMessage: string;
    cliExitCode: number;
    errorNotificationMessage: string;
  }
} = {
  force_function_start_plugin_not_installed: {
    cliMessage: 'is not a sfdx command',
    cliExitCode: 127,
    errorNotificationMessage: nls.localize(
      'force_function_start_warning_plugin_not_installed'
    )
  },
  force_function_start_docker_plugin_not_installed_or_started: {
    cliMessage: 'Cannot connect to the Docker daemon',
    cliExitCode: 1,
    errorNotificationMessage: nls.localize(
      'force_function_start_warning_docker_not_installed_or_not_started'
    )
  }
};

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
   * Locate the directory that has function.toml.
   * If sourceFsPath is the function folder that has function.toml, or a subdirectory
   * or file within that folder, this method returns the function folder by recursively looking up.
   * Otherwise, it returns undefined.
   * @param sourceFsPath path to start function from
   */
  public static getFunctionDir(sourceFsPath: string) {
    let current = fs.lstatSync(sourceFsPath).isDirectory()
      ? sourceFsPath
      : path.dirname(sourceFsPath);
    const { root } = path.parse(sourceFsPath);
    const rootWorkspacePath = getRootWorkspacePath();
    while (current !== rootWorkspacePath && current !== root) {
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
      const warningMessage = nls.localize(
        'force_function_start_warning_no_toml'
      );
      notificationService.showWarningMessage(warningMessage);
      telemetryService.sendException(
        'force_function_start_no_toml',
        warningMessage
      );
      return;
    }
    const execution = new CliCommandExecutor(this.build(functionDirPath), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    const executionName = execution.command.toString();

    const registeredStartedFunctionDisposable = FunctionService.instance.registerStartedFunction(
      {
        terminate: () => {
          return execution.killExecution('SIGTERM');
        }
      }
    );

    channelService.streamCommandOutput(execution);
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

    // Adding error messages here during command execution
    const errorMessages = new Set();
    execution.stderrSubject.subscribe(data => {
      (Object.keys(
        forceFunctionStartErrorInfo
      ) as ForceFunctionStartErrorType[]).forEach(errorType => {
        const { cliMessage } = forceFunctionStartErrorInfo[errorType];
        if (data.toString().includes(cliMessage)) {
          errorMessages.add(cliMessage);
        }
      });
    });

    execution.processExitSubject.subscribe(async exitCode => {
      if (typeof exitCode === 'number' && exitCode !== 0) {
        let unexpectedError = true;
        (Object.keys(
          forceFunctionStartErrorInfo
        ) as ForceFunctionStartErrorType[]).forEach(errorType => {
          const {
            cliMessage,
            cliExitCode,
            errorNotificationMessage
          } = forceFunctionStartErrorInfo[errorType];
          // Matches error message and exit code
          if (exitCode === cliExitCode && errorMessages.has(cliMessage)) {
            unexpectedError = false;
            telemetryService.sendException(errorType, errorNotificationMessage);
            notificationService.showErrorMessage(errorNotificationMessage);
            channelService.appendLine(`Error: ${errorNotificationMessage}`);
            channelService.showChannelOutput();
          }
        });

        if (unexpectedError) {
          const errorNotificationMessage = nls.localize(
            'force_function_start_unexpected_error',
            exitCode
          );
          telemetryService.sendException(
            'force_function_start_unexpected_error',
            errorNotificationMessage
          );
          notificationService.showErrorMessage(errorNotificationMessage);
          channelService.appendLine(`Error: ${errorNotificationMessage}`);
          channelService.showChannelOutput();
        }
        notificationService.showErrorMessage(
          nls.localize(
            'notification_unsuccessful_execution_text',
            nls.localize('force_function_start_text')
          )
        );
      }
      progress.complete();
      registeredStartedFunctionDisposable.dispose();
    });

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
export async function forceFunctionStart(sourceUri?: Uri) {
  if (!sourceUri) {
    // Try to start function from current active editor, if running SFDX: start function from command palette
    sourceUri = window.activeTextEditor?.document.uri!;
  }
  if (!sourceUri) {
    const warningMessage = nls.localize(
      'force_function_start_warning_not_in_function_folder'
    );
    notificationService.showWarningMessage(warningMessage);
    telemetryService.sendException(
      'force_function_start_not_in_function_folder',
      warningMessage
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
