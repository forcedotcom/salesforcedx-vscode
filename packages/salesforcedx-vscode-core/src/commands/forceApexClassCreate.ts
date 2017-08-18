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
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import glob = require('glob');
import { nls } from '../messages';
import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

const APEX_FILE_EXTENSION = '.cls';

class SelectFileName implements ParametersGatherer<{ fileName: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName: string }>
  > {
    const fileNameInputOptions = <vscode.InputBoxOptions>{
      prompt: nls.localize('force_apex_class_create_enter_file_name')
    };
    const fileName = await vscode.window.showInputBox(fileNameInputOptions);
    return fileName
      ? { type: 'CONTINUE', data: { fileName } }
      : { type: 'CANCEL' };
  }
}

class SelectDirPath implements ParametersGatherer<{ outputdir: string }> {
  private explorerDir: string | undefined;

  public constructor(explorerDir?: { path: string }) {
    this.explorerDir = explorerDir ? explorerDir.path : explorerDir;
  }

  public globDirs(srcPath: string, priorityKeyword?: string): string[] {
    const unprioritizedRelDirs = new glob.GlobSync(
      path.join(srcPath, '**/')
    ).found.map(value => {
      let relativePath = path.relative(srcPath, path.join(value, '/'));
      relativePath = path.join(relativePath, '');
      return relativePath;
    });
    if (priorityKeyword) {
      const notPrioritized: string[] = [];
      const prioritized = unprioritizedRelDirs.filter(dir => {
        if (dir.includes(priorityKeyword)) {
          return true;
        } else {
          notPrioritized.push(dir);
        }
      });
      return prioritized.concat(notPrioritized);
    }
    return unprioritizedRelDirs;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ outputdir: string }>
  > {
    const rootPath = vscode.workspace.rootPath;
    let outputdir;
    if (rootPath) {
      outputdir = this.explorerDir
        ? this.explorerDir
        : await vscode.window.showQuickPick(
            this.globDirs(rootPath, 'classes'),
            <vscode.QuickPickOptions>{
              placeHolder: nls.localize(
                'force_apex_class_create_enter_dir_name'
              )
            }
          );
    }
    return outputdir
      ? { type: 'CONTINUE', data: { outputdir } }
      : { type: 'CANCEL' };
  }
}

class ForceApexClassCreateExecutor extends SfdxCommandletExecutor<
  DirFileNameSelection
> {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_class_create'))
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

export async function forceApexClassCreate(explorerDir?: any) {
  const outputDirGatherer = new SelectDirPath(explorerDir);
  const parameterGatherer = new CompositeParametersGatherer<
    DirFileNameSelection
  >(fileNameGatherer, outputDirGatherer);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexClassCreateExecutor()
  );
  commandlet.run();
}
