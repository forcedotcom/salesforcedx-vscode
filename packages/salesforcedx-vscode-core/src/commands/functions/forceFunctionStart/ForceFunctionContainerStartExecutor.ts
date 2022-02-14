import { getFunctionsBinary } from '@heroku/functions-core';
import * as vscode from 'vscode';
import { channelService } from '../../../channels';
import { nls } from '../../../messages';
import { notificationService } from '../../../notifications';
import { telemetryService } from '../../../telemetry';
import { FunctionService } from '../functionService';
import { FUNCTION_RUNTIME_DETECTION_PATTERN } from '../types/constants';
import { ForceFunctionStartExecutor } from './ForceFunctionStartExecutor';

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

export class ForceFunctionContainerStartExecutor extends ForceFunctionStartExecutor {
  public async setupFunctionListeners(
    functionDirPath: string,
    functionDisposable: vscode.Disposable
  ): Promise<void> {
    const functionsBinary = await getFunctionsBinary();

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
      functionDisposable.dispose();
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
  }
  public async cancelFunction(
    registeredStartedFunctionDisposable: vscode.Disposable
  ): Promise<void> {
    const functionsBinary = await getFunctionsBinary();
    functionsBinary.cancel();
    registeredStartedFunctionDisposable.dispose();
  }

  public async buildFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    channelService.appendLine(`Building ${functionName}`);
    const functionsBinary = await getFunctionsBinary();
    await functionsBinary.build(functionName, {
      verbose: true,
      path: functionDirPath
    });
  }

  public async startFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    channelService.appendLine(`Starting ${functionName} in container`);
    const functionsBinary = await getFunctionsBinary();
    functionsBinary.run(functionName, {}).catch(err => console.log(err));
  }
}
