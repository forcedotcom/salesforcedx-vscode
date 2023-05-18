/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalRun, LocalRunProcess } from '@heroku/functions-core';
import { Disposable } from 'vscode';
import { channelService, notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../../../messages';
import { telemetryService } from '../../../telemetry';
import { FunctionService, functionType } from '../functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT
} from '../types/constants';
import { ForceFunctionStartExecutor } from './ForceFunctionStartExecutor';

export class ForceFunctionContainerlessStartExecutor extends ForceFunctionStartExecutor {
  private process: LocalRunProcess | undefined | void;

  public async setupFunctionListeners(): Promise<void> {
    console.log('No listeners for containerless function.');
  }

  public async cancelFunction(
    registeredStartedFunctionDisposable: Disposable
  ): Promise<void> {
    if (this.process && !this.process.cancelled) {
      this.process.cancel();
      this.process = undefined;
    }
    registeredStartedFunctionDisposable.dispose();
  }

  public async startFunction(functionName: string, functionDirPath: string): Promise<void> {
    const functionLanguage = FunctionService.instance.getFunctionType();
    channelService.appendLine(
      `Starting ${functionName} of type ${functionLanguage}`
    );

    const localRun = new LocalRun(functionLanguage, {
      path: functionDirPath,
      port: FUNCTION_DEFAULT_PORT,
      debugPort: FUNCTION_DEFAULT_DEBUG_PORT
    });

    const debugType = functionLanguage === functionType.JAVA ? 'java' : 'node';
    FunctionService.instance.updateFunction(functionDirPath, debugType);

    this.process = await localRun.exec()
      .catch((err: Error) => {
        const errorNotificationMessage = nls.localize(
          this.UNEXPECTED_ERROR_KEY
        );
        telemetryService.sendException(this.UNEXPECTED_ERROR_KEY, err.message);
        notificationService.showErrorMessage(errorNotificationMessage);
        channelService.appendLine(errorNotificationMessage);
        if (err.message) {
          channelService.appendLine(err.message);
        }
        channelService.showChannelOutput();
      });
  }
}
