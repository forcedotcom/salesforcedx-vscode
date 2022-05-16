/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Benny, getFunctionsBinary } from '@heroku/functions-core';
import * as vscode from 'vscode';
import { channelService } from '../../../channels';
import { nls } from '../../../messages';
import { notificationService } from '../../../notifications';
import { telemetryService } from '../../../telemetry';
import { FunctionService } from '../functionService';
import { FUNCTION_RUNTIME_DETECTION_PATTERN } from '../types/constants';
import { ForceFunctionStartExecutor } from './ForceFunctionStartExecutor';

export enum BINARY_EVENT_ENUM {
  CONTAINER = 'container',
  ERROR = 'error',
  LOG = 'log',
  PACK = 'pack'
}

const DOCKER_NOT_INSTALLED_KEY =
  'force_function_start_warning_docker_not_installed_or_not_started';
const DOCKER_NOT_INSTALLED_TYPE =
  'force_function_start_docker_plugin_not_installed_or_started';
const DOCKER_MISSING_ERROR = 'Cannot connect to the Docker daemon';

export class ForceFunctionContainerStartExecutor extends ForceFunctionStartExecutor {
  // The function binary. It must be used as a single instance. Multiple class to the getFunctionBinary
  // function will not provide the same instance of the binary.
  private functionsBinary: Benny | undefined;

  public async setupFunctionListeners(
    functionDirPath: string,
    functionDisposable: vscode.Disposable
  ): Promise<void> {
    this.functionsBinary = await getFunctionsBinary();

    const writeMsg = (msg: { text: string; timestamp: string }) => {
      const outputMsg = msg.text;

      if (outputMsg) {
        channelService.appendLine(outputMsg);

        const matches = String(outputMsg).match(
          FUNCTION_RUNTIME_DETECTION_PATTERN
        );
        const [, firstMatch] = matches ?? [];
        if (firstMatch) {
          FunctionService.instance.updateFunction(functionDirPath, firstMatch, false);
        }
      }
    };

    const handleError = (error: any) => {
      functionDisposable.dispose();
      let unexpectedError = true;

      if (error.text?.includes(DOCKER_MISSING_ERROR)) {
        const errorNotificationMessage = nls.localize(DOCKER_NOT_INSTALLED_KEY);
        unexpectedError = false;
        telemetryService.sendException(
          DOCKER_NOT_INSTALLED_TYPE,
          errorNotificationMessage
        );
        notificationService.showErrorMessage(errorNotificationMessage);
        channelService.appendLine(errorNotificationMessage);
      }

      if (unexpectedError) {
        const errorNotificationMessage = nls.localize(
          this.UNEXPECTED_ERROR_KEY
        );
        telemetryService.sendException(
          this.UNEXPECTED_ERROR_KEY,
          errorNotificationMessage
        );
        notificationService.showErrorMessage(errorNotificationMessage);
        channelService.appendLine(errorNotificationMessage);
      }
      channelService.showChannelOutput();
    };

    this.functionsBinary.on(BINARY_EVENT_ENUM.PACK, writeMsg);
    this.functionsBinary.on(BINARY_EVENT_ENUM.CONTAINER, writeMsg);

    this.functionsBinary.on(BINARY_EVENT_ENUM.LOG, (msg: any) => {
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
    // and sending custom telemetry data for predefined errors
    this.functionsBinary.on(BINARY_EVENT_ENUM.ERROR, handleError);
  }
  public async cancelFunction(
    registeredStartedFunctionDisposable: vscode.Disposable
  ): Promise<void> {
    if (this.functionsBinary !== undefined) {
      this.functionsBinary.cancel();
    }
    this.functionsBinary = undefined;
    registeredStartedFunctionDisposable.dispose();
  }

  public async buildFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    channelService.appendLine(`Building ${functionName}`);

    if (!this.functionsBinary) {
      throw new Error('Unable to find binary for building function.');
    }

    await this.functionsBinary.build(functionName, {
      verbose: true,
      path: functionDirPath
    });
  }

  public async startFunction(functionName: string): Promise<void> {
    channelService.appendLine(`Starting ${functionName} in container`);
    if (!this.functionsBinary) {
      throw new Error('Unable to start function with no binary.');
    }

    await this.functionsBinary.run(functionName, {}).catch(err => {
      console.log(err);
    });
  }
}
