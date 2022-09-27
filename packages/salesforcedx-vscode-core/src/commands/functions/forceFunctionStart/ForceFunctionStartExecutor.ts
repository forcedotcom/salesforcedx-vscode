/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getProjectDescriptor } from '@heroku/functions-core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../../../channels';
import { nls } from '../../../messages';
import { notificationService } from '../../../notifications';
import { telemetryService } from '../../../telemetry';
import { OrgAuthInfo } from '../../../util';
import { FunctionService } from '../functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT
} from '../types/constants';

export abstract class ForceFunctionStartExecutor extends LibraryCommandletExecutor<
  string
> {
  protected UNEXPECTED_ERROR_KEY = 'force_function_start_unexpected_error';

  constructor(startMessageKey: string, logName: string) {
    super(nls.localize(startMessageKey), logName, OUTPUT_CHANNEL);
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

    channelService.showChannelOutput();

    try {
      await OrgAuthInfo.getDefaultUsernameOrAlias(false).then(
        defaultUsernameorAlias => {
          if (!defaultUsernameorAlias) {
            const message = nls.localize('force_function_start_no_org_auth');
            channelService.appendLine(message);
            channelService.showChannelOutput();
            notificationService.showInformationMessage(message);
          }
        }
      );
    } catch (error) {
      // ignore, getDefaultUsernameOrAlias catches the error and logs telemetry
    }

    const registeredStartedFunctionDisposable = FunctionService.instance.registerStartedFunction(
      {
        rootDir: functionDirPath,
        port: FUNCTION_DEFAULT_PORT,
        debugPort: FUNCTION_DEFAULT_DEBUG_PORT,
        // Note this defaults to node but will be updated by the updateFunction method after the function is started if necessary.
        debugType: 'node',
        terminate: () => {
          return new Promise(resolve =>
            resolve(this.cancelFunction(registeredStartedFunctionDisposable))
          );
        },
        isContainerLess: false
      }
    );

    this.telemetry.addProperty(
      'language',
      FunctionService.instance.getFunctionLanguage()
    );

    await this.setupFunctionListeners(
      functionDirPath,
      registeredStartedFunctionDisposable
    );

    token?.onCancellationRequested(() => {
      this.cancelFunction(registeredStartedFunctionDisposable);
      registeredStartedFunctionDisposable.dispose();
    });

    channelService.appendLine('Parsing project.toml');
    const descriptor = await getProjectDescriptor(
      path.join(functionDirPath, 'project.toml')
    );
    const functionName = descriptor.com.salesforce.id;

    this.buildFunction(functionName, functionDirPath);

    channelService.appendLine(`Starting ${functionName}`);
    await this.startFunction(functionName, functionDirPath);
    return true;
  }

  public abstract setupFunctionListeners(
    functionDirPath: string,
    functionDisposable: vscode.Disposable
  ): Promise<void>;

  public abstract cancelFunction(
    registeredStartedFunctionDisposable: vscode.Disposable
  ): void;

  public abstract buildFunction(
    functionName: string,
    functionDirPath: string
  ): void;

  public abstract startFunction(
    functionName: string,
    functionDirPath?: string
  ): void;
}
