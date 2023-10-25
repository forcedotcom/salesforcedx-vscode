/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Executes sfdx run:function --url http://localhost:8080 --payload=@functions/MyFunction/payload.json
 */
import { runFunction } from '@heroku/functions-core';
import { ContinueResponse, LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { Uri } from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { FunctionService } from './functionService';

type ErrorResponse = Error & { response: { status?: number; data?: any; statusText?: string } };

export class ForceFunctionInvoke extends LibraryCommandletExecutor<string> {
  constructor(debug: boolean = false) {
    super(
      nls.localize('force_function_invoke_text'),
      debug ? 'force_function_debug_invoke' : 'force_function_invoke',
      OUTPUT_CHANNEL
    );
    this.telemetry.addProperty(
      'language',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      FunctionService.instance.getFunctionLanguage()
    );
  }
  public async run(response: ContinueResponse<string>): Promise<boolean> {
    const defaultUsername = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    const url = 'http://localhost:8080';
    const data = fs.readFileSync(response.data, 'utf8');
    try {
      channelService.appendLine(`POST ${url}`);

      const functionResponse = await runFunction({
        url,
        payload: data,
        targetusername: defaultUsername
      });
      channelService.appendLine(
        JSON.stringify(functionResponse.data, undefined, 4)
      );
    } catch (error) {
      const errorResponse = (error instanceof Error ? error : typeof error === 'string' ?
        new Error(error) : new Error('Unknown error')) as ErrorResponse;
      channelService.appendLine(errorResponse.message);
      if (errorResponse.response) {
        if (errorResponse.response.statusText) {
          channelService.appendLine(errorResponse.response.statusText);
        }
        if (errorResponse.response.data) {
          channelService.appendLine(
            JSON.stringify(errorResponse.response.data, undefined, 4)
          );
        }
      }
      return false;
    }
    return true;
  }
}

export const forceFunctionInvoke = async (sourceUri: Uri) => {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceFunctionInvoke()
  );
  await commandlet.run();
};

export const forceFunctionDebugInvoke = async (sourceUri: Uri) => {
  const localRoot = FunctionService.getFunctionDir(sourceUri.fsPath);
  if (!localRoot) {
    const warningMessage = nls.localize('force_function_start_warning_no_toml');
    void notificationService.showWarningMessage(warningMessage);
    telemetryService.sendException(
      'force_function_debug_invoke_no_toml',
      warningMessage
    );
    return;
  }

  await FunctionService.instance.debugFunction(localRoot);

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceFunctionInvoke(true)
  );
  await commandlet.run();

  await FunctionService.instance.stopDebuggingFunction(localRoot);
};
