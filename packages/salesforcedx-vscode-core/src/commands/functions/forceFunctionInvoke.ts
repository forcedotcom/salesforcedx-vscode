/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Executes sfdx evergreen:function:invoke http://localhost:8080 --payload=@functions/MyFunction/payload.json
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { Uri } from 'vscode';
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

export class ForceFunctionInvoke extends SfdxCommandletExecutor<string> {
  public build(payloadUri: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_function_invoke_text'))
      .withArg('evergreen:function:invoke')
      .withArg('http://localhost:8080')
      .withFlag('--payload', `@${payloadUri}`)
      .withLogName('force_function_invoke')
      .build();
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
