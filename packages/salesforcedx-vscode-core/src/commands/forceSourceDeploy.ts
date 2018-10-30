/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  ForceDeployErrorParser,
  ForceSourceDeployErrorResult,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import {
  FileType,
  ManifestOrSourcePathGatherer,
  SelectedPath
} from './forceSourceRetrieve';

vscode.workspace.onDidChangeTextDocument(e => {
  if (ForceSourceDeployExecutor.errorCollection.has(e.document.uri)) {
    ForceSourceDeployExecutor.errorCollection.delete(e.document.uri);
  }
});

export class ForceSourceDeployExecutor extends SfdxCommandletExecutor<
  SelectedPath
> {
  public static errorCollection = vscode.languages.createDiagnosticCollection(
    'deploy-errors'
  );

  public build(data: SelectedPath): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_deploy')
      .withJson();
    if (data.type === FileType.Manifest) {
      commandBuilder.withFlag('--manifest', data.filePath);
    } else {
      commandBuilder.withFlag('--sourcepath', data.filePath);
    }
    return commandBuilder.build();
  }

  public execute(response: ContinueResponse<SelectedPath>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.path
      : '';
    const execFilePath = response.data.filePath;
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
          this.handleDiagnosticErrors(fileErrors, workspacePath, execFilePath);
        } catch (e) {
          // TODO: add metric to track issues.
          console.log(`Could not parse Compile Errors`);
        }
      }
    });

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    this.logMetric(execution.command.logName);
  }

  private handleDiagnosticErrors(
    errors: ForceSourceDeployErrorResult,
    workspacePath: string,
    sourcePath: string
  ) {
    ForceSourceDeployExecutor.errorCollection.clear();
    const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
    if (errors.hasOwnProperty('result')) {
      errors.result.forEach(error => {
        // source:deploys sometimes returns N/A as filePath
        const fileUri =
          error.filePath === 'N/A'
            ? sourcePath
            : path.join(workspacePath, error.filePath);
        const range = this.getRange(error.lineNumber, error.columnNumber);
        const diagnostic = {
          message: error.error,
          severity: vscode.DiagnosticSeverity.Error,
          source: error.type,
          range
        } as vscode.Diagnostic;

        if (!diagnosticMap.has(fileUri)) {
          diagnosticMap.set(fileUri, []);
        }

        diagnosticMap.get(fileUri)!.push(diagnostic);
      });

      diagnosticMap.forEach((diagMap: vscode.Diagnostic[], file) => {
        const fileUri = vscode.Uri.file(file);
        ForceSourceDeployExecutor.errorCollection.set(fileUri, diagMap);
      });
    } else if (errors.hasOwnProperty('message')) {
      const fileUri = vscode.Uri.file(sourcePath);
      const range = this.getRange('1', '1');
      const diagnostic = {
        message: errors.message,
        severity: vscode.DiagnosticSeverity.Error,
        source: errors.name,
        range
      } as vscode.Diagnostic;

      ForceSourceDeployExecutor.errorCollection.set(fileUri, [diagnostic]);
    }
  }

  private getRange(lineNumber: string, columnNumber: string): vscode.Range {
    const ln = Number(lineNumber) - 1;
    const col = Number(columnNumber) - 1;
    return new vscode.Range(
      new vscode.Position(ln, col),
      new vscode.Position(ln, col)
    );
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceSourceDeploy(explorerPath: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new ManifestOrSourcePathGatherer(explorerPath),
    new ForceSourceDeployExecutor()
  );
  await commandlet.run();
}
