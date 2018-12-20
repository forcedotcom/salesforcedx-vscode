/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  ForceDeployErrorParser
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { handleDiagnosticErrors } from '../diagnostics';
import { telemetryService } from '../telemetry';
import { SfdxCommandletExecutor } from './commands';

vscode.workspace.onDidChangeTextDocument(e => {
  if (ForceSourceDeployExecutor.errorCollection.has(e.document.uri)) {
    ForceSourceDeployExecutor.errorCollection.delete(e.document.uri);
  }
});

export abstract class ForceSourceDeployExecutor extends SfdxCommandletExecutor<
  string
> {
  public static errorCollection = vscode.languages.createDiagnosticCollection(
    'deploy-errors'
  );

  public execute(response: ContinueResponse<string>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : '';
    const execFilePathOrPaths = response.data;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspacePath
    }).execute(cancellationToken);

    let stdErr = '';
    execution.stderrSubject.subscribe(realData => {
      stdErr += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      if (exitCode !== 0) {
        try {
          const deployErrorParser = new ForceDeployErrorParser();
          const fileErrors = deployErrorParser.parse(stdErr);
          handleDiagnosticErrors(
            fileErrors,
            workspacePath,
            execFilePathOrPaths,
            ForceSourceDeployExecutor.errorCollection
          );
        } catch (e) {
          telemetryService.sendError(
            'Error while creating diagnostics for vscode problem view.'
          );
          console.error(
            'Error while creating diagnostics for vscode problem view.'
          );
        }
      }
    });

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    this.logMetric(execution.command.logName);
  }
}
