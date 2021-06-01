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
  FUNCTION_DEFAULT_PORT
} from './types/constants';

import { RunFunction, StartFunction } from '@salesforce/functions-core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { OUTPUT_CHANNEL } from '../../channels';
import { streamFunctionCommandOutput } from './functionsCoreHelpers';

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

export class ForceFunctionStartExecutor extends LibraryCommandletExecutor<
  string
> {
  constructor() {
    super(
      nls.localize('force_function_start_text'),
      'force_function_start_library',
      OUTPUT_CHANNEL,
      true
    );
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

    const commandName = nls.localize('force_function_start_text');

    const startFunction = new StartFunction();
    const execution = startFunction.execute({
      verbose: true,
      path: functionDirPath
    });
    streamFunctionCommandOutput(commandName, startFunction);

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
        terminate: () => {
          return new Promise(resolve => resolve(startFunction.cancel()));
        }
      }
    );

    startFunction.on('error', data => {
      registeredStartedFunctionDisposable.dispose();
    });

    token?.onCancellationRequested(() => {
      startFunction.cancel();
      registeredStartedFunctionDisposable.dispose();
    });
    // TODO: Loading progress bar until sesssion start?
    return await execution;
  }
}

/**
 * Executes sfdx run:function:start --verbose
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
