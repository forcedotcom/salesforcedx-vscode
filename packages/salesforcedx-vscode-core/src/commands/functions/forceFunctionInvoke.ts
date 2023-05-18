/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Executes sfdx run:function --url http://localhost:8080 --payload=@functions/MyFunction/payload.json
 */
import { Uri } from 'vscode';
import { channelService, notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { FunctionService } from './functionService';

import { runFunction } from '@heroku/functions-core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';

export class ForceFunctionInvoke extends LibraryCommandletExecutor<string> {
  constructor(debug: boolean = false) {
    super(
      nls.localize('force_function_invoke_text'),
      debug ? 'force_function_debug_invoke' : 'force_function_invoke',
      OUTPUT_CHANNEL
    );
    this.telemetry.addProperty(
      'language',
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
      channelService.appendLine(error);
      if (error.response) {
        channelService.appendLine(error.response);
        channelService.appendLine(
          JSON.stringify(error.response.data, undefined, 4)
        );
      }
      return false;
    }
    return true;
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
    new ForceFunctionInvoke(true)
  );
  await commandlet.run();

  await FunctionService.instance.stopDebuggingFunction(localRoot);
}
