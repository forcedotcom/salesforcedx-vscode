/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  DirFileNameSelection
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';
import {
  CompositeParametersGatherer,
  FilePathExistsChecker,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

const APEX_TRIGGER_EXTENSION = '.trigger';
const APEX_TRIGGER_METADATA_DIR = 'triggers';

export class ForceApexTriggerCreateExecutor extends SfdxCommandletExecutor<
  DirFileNameSelection
> {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_trigger_create_text'))
      .withArg('force:apex:trigger:create')
      .withFlag('--triggername', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_apex_trigger_create')
      .build();
  }

  public execute(response: ContinueResponse<DirFileNameSelection>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      const dirType = response.data.outputdir.endsWith(
        path.join(SelectOutputDir.defaultOutput, APEX_TRIGGER_METADATA_DIR)
      )
        ? 'defaultDir'
        : 'customDir';
      this.logMetric(execution.command.logName, startTime, { dirType });
      if (data !== undefined && data.toString() === '0' && hasRootWorkspace()) {
        vscode.workspace
          .openTextDocument(
            path.join(
              getRootWorkspacePath(),
              response.data.outputdir,
              response.data.fileName + APEX_TRIGGER_EXTENSION
            )
          )
          .then(document => vscode.window.showTextDocument(document));
      }
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new SelectFileName();
const filePathExistsChecker = new FilePathExistsChecker(APEX_TRIGGER_EXTENSION);

export async function forceApexTriggerCreate() {
  const outputDirGatherer = new SelectOutputDir(APEX_TRIGGER_METADATA_DIR);
  const parameterGatherer = new CompositeParametersGatherer<
    DirFileNameSelection
  >(fileNameGatherer, outputDirGatherer);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexTriggerCreateExecutor(),
    filePathExistsChecker
  );
  await commandlet.run();
}
