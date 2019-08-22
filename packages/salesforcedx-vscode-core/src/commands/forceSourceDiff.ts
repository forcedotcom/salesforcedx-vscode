/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  DiffResultParser,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceSourceDiffExecutor extends SfdxCommandletExecutor<string> {
  public build(filePath: string): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_diff_text'))
      .withArg('force:source:diff')
      .withLogName('force_source_diff')
      .withFlag('--sourcepath', filePath)
      .withJson();
    return commandBuilder.build();
  }

  public async execute(response: ContinueResponse<string>): Promise<void> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath(),
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);
    channelService.showChannelOutput();

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      console.log('exitcode ===> ', exitCode);
      this.logMetric(execution.command.logName, startTime);
      await handleDiffResponse(exitCode, stdOut);
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export async function handleDiffResponse(
  exitCode: number | undefined,
  stdOut: string
) {
  try {
    if (exitCode === 127) {
      throw new Error(nls.localize('force_source_diff_command_not_found'));
    }
    const diffParser = new DiffResultParser(stdOut);
    const diffParserSuccess = diffParser.getSuccessResponse();
    const diffParserError = diffParser.getErrorResponse();

    if (diffParserSuccess) {
      const diffResult = diffParserSuccess.result;
      const remote = vscode.Uri.file(diffResult.remote);
      const local = vscode.Uri.file(diffResult.local);
      const filename = diffResult.fileName;

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
        nls.localize(
          'force_source_diff_title',
          defaultUsernameorAlias,
          filename,
          filename
        )
      );
    } else if (diffParserError) {
      channelService.appendLine(diffParserError.message);
    }
  } catch (e) {
    notificationService.showErrorMessage(e.message);
    channelService.appendLine(e.message);
    telemetryService.sendException(e.name, e.message);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceSourceDiff(sourceUri: vscode.Uri) {
  if (!sourceUri) {
    const editor = vscode.window.activeTextEditor;
    if (
      editor &&
      (editor.document.languageId === 'apex' ||
        editor.document.languageId === 'visualforce' ||
        editor.document.fileName.includes('aura') ||
        editor.document.fileName.includes('lwc'))
    ) {
      sourceUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize('force_source_diff_unsupported_type');
      telemetryService.sendException('unsupported_type_on_diff', errorMessage);
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new FilePathGatherer(sourceUri),
    new ForceSourceDiffExecutor()
  );
  await commandlet.run();
}
