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
import { telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

import { Uri, window } from 'vscode';
import { FunctionService } from './functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT,
  FUNCTION_RUNTIME_DETECTION_PATTERN
} from './types/constants';

const LOG_NAME = 'force_function_start';

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
  };
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
      .withArg('run:function:start')
      .withArg('--verbose')
      .withLogName(LOG_NAME)
      .build();
  }

  public execute(response: ContinueResponse<string>) {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const sourceFsPath = response.data;
    const functionDirPath = FunctionService.getFunctionDir(sourceFsPath);
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

    cancellationToken.onCancellationRequested(async () => {
      await execution.killExecution('SIGTERM');
      this.logMetric(
          'force_function_start_cancelled',
          startTime,
          { language: FunctionService.instance.getFunctionLanguage() }
      );
    });

    OrgAuthInfo.getDefaultUsernameOrAlias(false)
      .then(defaultUsernameorAlias => {
        if (!defaultUsernameorAlias) {
          const message = nls.localize('force_function_start_no_org_auth');
          channelService.appendLine(message);
          channelService.showChannelOutput();
          notificationService.showInformationMessage(message);
        }
      })
      .catch(error => {
        // ignore, getDefaultUsernameOrAlias catches the error and logs telemetry
      });

    const registeredStartedFunctionDisposable = FunctionService.instance.registerStartedFunction(
      {
        rootDir: functionDirPath,
        port: FUNCTION_DEFAULT_PORT,
        debugPort: FUNCTION_DEFAULT_DEBUG_PORT,
        debugType: 'node',
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
      const matches = String(data).match(FUNCTION_RUNTIME_DETECTION_PATTERN);
      if (matches && matches.length > 1) {
        FunctionService.instance.updateFunction(functionDirPath, matches[1]);
      } else if (data.toString().includes('Debugger running on port')) {
        progress.complete();
        taskViewService.removeTask(task);
        notificationService
          .showSuccessfulExecution(executionName)
          .catch(() => {});
        this.logMetric(
            execution.command.logName,
            startTime,
            { language: FunctionService.instance.getFunctionLanguage() }
        );
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
 * Executes sfdx run:function:start --verbose
 * @param sourceUri
 */
export async function forceFunctionStart(sourceUri?: Uri) {
  const startTime = process.hrtime();
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

  telemetryService.sendCommandEvent(
    LOG_NAME,
    startTime,
    { language: FunctionService.instance.getFunctionLanguage() }
  );
}
