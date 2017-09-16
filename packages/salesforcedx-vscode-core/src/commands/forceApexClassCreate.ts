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
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  CompositeParametersGatherer,
  ContinueResponse,
  DirFileNameSelection,
  FilePathExistsChecker,
  SelectFileName,
  SelectPrioritizedDirPath,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

const APEX_FILE_EXTENSION = '.cls';

class ForceApexClassCreateExecutor extends SfdxCommandletExecutor<
  DirFileNameSelection
> {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_class_create_text'))
      .withArg('force:apex:class:create')
      .withFlag('--classname', data.fileName)
      .withFlag('--template', 'DefaultApexClass')
      .withFlag('--outputdir', data.outputdir)
      .build();
  }

  public execute(response: ContinueResponse<DirFileNameSelection>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      if (
        data != undefined &&
        data.toString() === '0' &&
        vscode.workspace.rootPath
      ) {
        vscode.workspace
          .openTextDocument(
            path.join(
              vscode.workspace.rootPath,
              response.data.outputdir,
              response.data.fileName + APEX_FILE_EXTENSION
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
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new SelectFileName();
const filePathExistsChecker = new FilePathExistsChecker(APEX_FILE_EXTENSION);

export async function forceApexClassCreate(explorerDir?: any) {
  const outputDirGatherer = new SelectPrioritizedDirPath(
    explorerDir,
    'classes'
  );
  const parameterGatherer = new CompositeParametersGatherer<
    DirFileNameSelection
  >(fileNameGatherer, outputDirGatherer);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexClassCreateExecutor(),
    filePathExistsChecker
  );
  commandlet.run();
}
