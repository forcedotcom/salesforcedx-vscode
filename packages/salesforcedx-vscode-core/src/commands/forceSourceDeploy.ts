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
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
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
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
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
          handleDiagnosticErrors(
            fileErrors,
            workspacePath,
            execFilePath,
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

export class MultipleSourcePathsGatherer
  implements ParametersGatherer<SelectedPath> {
  private uris: vscode.Uri[];
  public constructor(uris: vscode.Uri[]) {
    this.uris = uris;
  }
  public async gather(): Promise<ContinueResponse<SelectedPath>> {
    const sourcePaths = this.uris.map(uri => uri.fsPath).join(',');
    return {
      type: 'CONTINUE',
      data: { filePath: sourcePaths, type: FileType.Source }
    };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceSourceDeployMultipleSourcePaths(uris: vscode.Uri[]) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new MultipleSourcePathsGatherer(uris),
    new ForceSourceDeployExecutor()
  );
  await commandlet.run();
}

export async function forceSourceDeployManifestOrSourcePath(
  explorerPath: vscode.Uri
) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new ManifestOrSourcePathGatherer(explorerPath),
    new ForceSourceDeployExecutor()
  );
  await commandlet.run();
}
