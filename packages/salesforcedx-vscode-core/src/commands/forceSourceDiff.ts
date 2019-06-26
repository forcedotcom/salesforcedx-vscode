/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceSourceDiffExecutor extends SfdxCommandletExecutor<{
  filePath: string;
}> {
  public build(data: { filePath: string }): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_diff_text'))
      .withArg('force:source:diff')
      .withLogName('force_source_diff')
      .withFlag('--sourcepath', data.filePath);
    return commandBuilder.build();
  }

  public async execute(
    response: ContinueResponse<{ filePath: string }>
  ): Promise<void> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);
    channelService.showChannelOutput();

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async () => {
      this.logMetric(execution.command.logName, startTime);
      console.log('------ stdOut ==> ', stdOut);
      try {
        const sanitized = stdOut.substring(
          stdOut.indexOf('{'),
          stdOut.lastIndexOf('}') + 1
        );
        // TODO: add a custom type here.
        // tslint:disable-next-line:no-shadowed-variable
        const response = JSON.parse(sanitized);
        const remote = vscode.Uri.parse(response.remote);
        const local = vscode.Uri.parse(response.local);
        const filename = response.fileName;
        let defaultUsernameorAlias: string | undefined;
        if (hasRootWorkspace()) {
          defaultUsernameorAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(
            false
          );
        }
        vscode.commands.executeCommand(
          'vscode.diff',
          remote,
          local,
          `${defaultUsernameorAlias}//${filename} ↔ local//${filename}`
        );
      } catch (e) {
        const err = new Error('Error parsing diff result');
        err.name = 'DiffParserFail';
        throw err;
      }
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export class SourcePathGatherer
  implements ParametersGatherer<{ filePath: string }> {
  private sourcePath: string;

  public constructor(uri: vscode.Uri) {
    this.sourcePath = uri.fsPath;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ filePath: string }>
  > {
    return { type: 'CONTINUE', data: { filePath: this.sourcePath } };
  }
}

export async function forceSourceDiff(sourceUri: vscode.Uri) {
  if (!sourceUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'apex') {
      sourceUri = editor.document.uri;
    } else {
      const errorMessage = 'File is not apex';
      telemetryService.sendError(errorMessage);
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new SourcePathGatherer(sourceUri),
    new ForceSourceDiffExecutor()
  );
  await commandlet.run();
}
