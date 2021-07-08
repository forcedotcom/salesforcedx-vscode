/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
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
  SfdxWorkspaceChecker
} from '../util';

import { Uri, window } from 'vscode';
import { FunctionService } from './functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT,
  FUNCTION_RUNTIME_DETECTION_PATTERN
} from './types/constants';

import { getFunctionsBinary } from '@heroku/functions-core';
import { getProjectDescriptor } from '@heroku/functions-core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { OUTPUT_CHANNEL } from '../../channels';

const LOG_NAME = 'force_function_start';

/**
 * Error types when running SFDX: Start Function
 * This is also used as the telemetry log name.
 */
type ForceFunctionStartErrorType = 'force_function_start_docker_plugin_not_installed_or_started';

const forceFunctionStartErrorInfo: {
  [key in ForceFunctionStartErrorType]: {
    cliMessage: string;
    errorNotificationMessage: string;
  };
} = {
  force_function_start_docker_plugin_not_installed_or_started: {
    cliMessage: 'Cannot connect to the Docker daemon',
    errorNotificationMessage: nls.localize(
      'force_function_start_warning_docker_not_installed_or_not_started'
    )
  }
};

export class ForceFunctionStartExecutor extends LibraryCommandletExecutor<
  string
> {
  constructor() {
    super(nls.localize('force_function_start_text'), LOG_NAME, OUTPUT_CHANNEL);
    this.cancellable = true;
  }
  public async run(
    response: ContinueResponse<string>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
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
      return false;
    }

    const functionsBinary = await getFunctionsBinary();
    channelService.showChannelOutput();

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
          return new Promise(resolve => resolve(functionsBinary.cancel()));
        }
      }
    );

    this.telemetry.addProperty(
      'language',
      FunctionService.instance.getFunctionLanguage()
    );

    const writeMsg = (msg: { text: string; timestamp: string }) => {
      const outputMsg = msg.text;

      if (outputMsg) {
        channelService.appendLine(outputMsg);

        const matches = String(outputMsg).match(
          FUNCTION_RUNTIME_DETECTION_PATTERN
        );
        if (matches && matches.length > 1) {
          FunctionService.instance.updateFunction(functionDirPath, matches[1]);
        }
      }
    };

    const handleError = (error: any) => {
      registeredStartedFunctionDisposable.dispose();
      let unexpectedError = true;
      (Object.keys(
        forceFunctionStartErrorInfo
      ) as ForceFunctionStartErrorType[]).forEach(errorType => {
        const {
          cliMessage,
          errorNotificationMessage
        } = forceFunctionStartErrorInfo[errorType];
        if (error.text?.includes(cliMessage)) {
          unexpectedError = false;
          telemetryService.sendException(errorType, errorNotificationMessage);
          notificationService.showErrorMessage(errorNotificationMessage);
          channelService.appendLine(errorNotificationMessage);
        }
      });

      if (unexpectedError) {
        const errorNotificationMessage = nls.localize(
          'force_function_start_unexpected_error'
        );
        telemetryService.sendException(
          'force_function_start_unexpected_error',
          errorNotificationMessage
        );
        notificationService.showErrorMessage(errorNotificationMessage);
        channelService.appendLine(errorNotificationMessage);
      }
      channelService.showChannelOutput();
    };

    functionsBinary.on('pack', writeMsg);
    functionsBinary.on('container', writeMsg);

    functionsBinary.on('log', (msg: any) => {
      if (msg.level === 'debug') return;
      if (msg.level === 'error') {
        handleError(msg);
      }

      if (msg.text) {
        writeMsg(msg);
      }

      // evergreen:benny:message {"type":"log","timestamp":"2021-05-10T10:00:27.953248-05:00","level":"info","fields":{"debugPort":"9229","localImageName":"jvm-fn-init","network":"","port":"8080"}} +21ms
      if (msg.fields && msg.fields.localImageName) {
        channelService.appendLine(`'Running on port' :${msg.fields.port}`);
        channelService.appendLine(
          `'Debugger running on port' :${msg.fields.debugPort}`
        );
      }
    });
    // Allows for showing custom notifications
    // and sending custom telemtry data for predefined errors
    functionsBinary.on('error', handleError);

    token?.onCancellationRequested(() => {
      functionsBinary.cancel();
      registeredStartedFunctionDisposable.dispose();
    });

    channelService.appendLine('Parsing project.toml');
    const descriptor = await getProjectDescriptor(
      path.join(functionDirPath, 'project.toml')
    );
    const functionName = descriptor.com.salesforce.id;
    channelService.appendLine(`Building ${functionName}`);
    await functionsBinary.build(functionName, {
      verbose: true,
      path: functionDirPath
    });
    channelService.appendLine(`Starting ${functionName}`);
    functionsBinary.run(functionName, {}).catch(err => console.log(err));
    return true;
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
}
