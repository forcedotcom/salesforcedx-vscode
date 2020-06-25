/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteAnonymousResponse } from '@salesforce/salesforcedx-apex/packages/apex';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
// tslint:disable-next-line:no-var-requires
const fs = require('fs').promises;
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleApexLibraryDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';
import {
  ApexLibraryExecutor,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

export class CreateApexTempFile
  implements ParametersGatherer<{ fileName: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName: string }>
  > {
    if (hasRootWorkspace()) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return { type: 'CANCEL' };
      }

      const document = editor.document;
      let fileName = document.uri.fsPath;
      if (!editor.selection.isEmpty) {
        fileName = path.join(
          getRootWorkspacePath(),
          '.sfdx',
          'tools',
          'tempApex.input'
        );
        await fs.writeFile(fileName, document.getText(editor.selection));
      }

      return { type: 'CONTINUE', data: { fileName } };
    }
    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new CreateApexTempFile();

export class ApexLibraryExecuteExecutor extends ApexLibraryExecutor {
  public async execute(
    response: ContinueResponse<{ fileName: string }>
  ): Promise<void> {
    this.setStartTime();

    try {
      await this.build(
        nls.localize('apex_execute_text'),
        nls.localize('force_apex_execute_library')
      );

      if (this.apexService === undefined) {
        throw new Error('ApexService is not established');
      }

      const fileName = response.data.fileName;
      this.apexService.apexExecute = this.executeWrapper(
        this.apexService.apexExecute
      );

      await this.apexService.apexExecute({
        apexCodeFile: fileName
      });
    } catch (e) {
      telemetryService.sendException('force_apex_execute_library', e.message);
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
    }
  }

  public executeWrapper(
    fn: (...args: any[]) => Promise<ExecuteAnonymousResponse>
  ) {
    const commandName = this.executionName;

    return async function(...args: any[]): Promise<ExecuteAnonymousResponse> {
      channelService.showCommandWithTimestamp(`Starting ${commandName}`);

      const result = await vscode.window.withProgress(
        {
          title: commandName,
          location: vscode.ProgressLocation.Notification
        },
        async () => {
          // @ts-ignore
          return (await fn.call(this, ...args)) as ExecuteAnonymousResponse;
        }
      );

      const formattedResult = formatResult(result);
      channelService.appendLine(formattedResult);
      channelService.showCommandWithTimestamp(`Finished ${commandName}`);

      if (result.result.compiled && result.result.success) {
        ApexLibraryExecuteExecutor.errorCollection.clear();
        await notificationService.showSuccessfulExecution(commandName);
      } else {
        handleApexLibraryDiagnostics(
          result,
          ApexLibraryExecuteExecutor.errorCollection,
          args[0].apexCodeFile
        );
        notificationService.showFailedExecution(commandName);
      }

      return result;
    };
  }
}

export function formatResult(
  execAnonResponse: ExecuteAnonymousResponse
): string {
  let outputText: string = '';
  if (execAnonResponse.result.compiled === true) {
    outputText += `${nls.localize('apex_execute_compile_success')}\n`;
    if (execAnonResponse.result.success === true) {
      outputText += `${nls.localize('apex_execute_runtime_success')}\n`;
    } else {
      outputText += `Error: ${execAnonResponse.result.exceptionMessage}\n`;
      outputText += `Error: ${execAnonResponse.result.exceptionStackTrace}\n`;
    }
    outputText += `\n${execAnonResponse.result.logs}`;
  } else {
    outputText += `Error: Line: ${execAnonResponse.result.line}, Column: ${
      execAnonResponse.result.column
    }\n`;
    outputText += `Error: ${execAnonResponse.result.compileProblem}\n`;
  }
  return outputText;
}

export async function forceApexExecute() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    fileNameGatherer,
    new ApexLibraryExecuteExecutor()
  );
  await commandlet.run();
}
