/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Executes sfdx run:function --url http://localhost:8080 --payload=@functions/MyFunction/payload.json
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CancellationToken, Progress, Uri } from 'vscode';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';
import { FunctionService } from './functionService';
import { OrgAuthInfo } from '../../util';
import { OUTPUT_CHANNEL } from '../../channels';

import { RunFunction } from '@salesforce/functions-core';
import {
  streamFunctionCommandOutput,
  
} from './functionsCoreHelpers';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
export class ForceFunctionInvoke extends LibraryCommandletExecutor<string> {
  constructor(){
    super(
      nls.localize('force_function_invoke_text'),
      'force_function_invoke_library',
      OUTPUT_CHANNEL
    );
  }
  async run(response: ContinueResponse<string>, progress?: Progress<{ message?: string | undefined; increment?: number | undefined; }>, token?: CancellationToken): Promise<boolean> {
        const defaultUsername = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
        const commandName = nls.localize('force_function_invoke_text');
    
        const runFunction = new RunFunction();
        const execution = runFunction.execute({
          url: 'http://localhost:8080',
          payload: `${response.data}`,
          targetusername: defaultUsername
        })
        streamFunctionCommandOutput(commandName, runFunction);
        return await execution;
  }
}

export async function forceFunctionInvoke(sourceUri: Uri) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceFunctionInvoke()
  );
  await commandlet.run();
}

export async function forceFunctionDebugInvoke(sourceUri: Uri) {
  const localRoot = FunctionService.getFunctionDir(sourceUri.fsPath);
  if (!localRoot) {
    const warningMessage = nls.localize('force_function_start_warning_no_toml');
    notificationService.showWarningMessage(warningMessage);
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
    new ForceFunctionInvoke()
  );
  await commandlet.run();

  if (commandlet.onDidFinishExecution) {
    commandlet.onDidFinishExecution(async startTime => {
      await FunctionService.instance.stopDebuggingFunction(localRoot);
      telemetryService.sendCommandEvent(
        'force_function_debug_invoke',
        startTime
      );
    });
  }
}
