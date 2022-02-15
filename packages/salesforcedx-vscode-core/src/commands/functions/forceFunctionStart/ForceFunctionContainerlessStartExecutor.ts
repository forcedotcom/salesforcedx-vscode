/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalRun } from '@heroku/functions-core';
import { Disposable } from 'vscode';
import { channelService } from '../../../channels';
import { nls } from '../../../messages';
import { notificationService } from '../../../notifications';
import { telemetryService } from '../../../telemetry';
import { FunctionService } from '../functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT
} from '../types/constants';
import { ForceFunctionStartExecutor } from './ForceFunctionStartExecutor';

export class ForceFunctionContainerlessStartExecutor extends ForceFunctionStartExecutor {
  public async setupFunctionListeners(
    functionDirPath: string,
    functionDisposable: Disposable
  ): Promise<void> {
    console.log('No listeners for containerless function.');
  }

  public async cancelFunction(
    registeredStartedFunctionDisposable: Disposable
  ): Promise<void> {
    // TODO: how to stop the localRun
    registeredStartedFunctionDisposable.dispose();
  }

  public async buildFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    console.log('No build for containerless function');
  }

  public async startFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    const functionLanguage = FunctionService.instance.getFunctionType();
    channelService.appendLine(
      `Starting ${functionName} of type ${functionLanguage}`
    );
    const localRun = new LocalRun(functionLanguage, {
      path: functionDirPath,
      port: FUNCTION_DEFAULT_PORT,
      debugPort: FUNCTION_DEFAULT_DEBUG_PORT
    });

    localRun
      .exec()
      .then(msg => {
        console.log(
          `localRun resolved in ForceFunctionContainerlessStartExecutor with message: ${msg}`
        );
      })
      .catch(err => {
        const errorNotificationMessage = nls.localize(
          this.UNEXPECTED_ERROR_KEY
        );
        telemetryService.sendException(this.UNEXPECTED_ERROR_KEY, err.message);
        notificationService.showErrorMessage(errorNotificationMessage);
        channelService.appendLine(errorNotificationMessage);
        channelService.showChannelOutput();
      });
  }
}
