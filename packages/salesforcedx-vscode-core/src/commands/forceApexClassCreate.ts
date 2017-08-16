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
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { CancellableStatusBar, taskViewService } from '../statuses';
import glob = require('glob');
import { nls } from '../messages';
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class SelectFilePath implements ParametersGatherer<DirFileNameSelection> {
  private explorerDir: string | undefined;
  private gatherers: ParametersGatherer<any>[] = [];

  public add(gatherer: ParametersGatherer<any>) {
    this.gatherers.push(gatherer);
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<DirFileNameSelection>
  > {
    const aggregatedData: any = {};
    for (const gatherer of this.gatherers) {
      const input = await gatherer.gather();
      if (input.type === 'CONTINUE') {
        Object.keys(input.data).map(
          key => (aggregatedData[key] = input.data[key])
        );
      } else {
        return input;
      }
    }
    return {
      type: 'CONTINUE',
      data: aggregatedData
    };
  }
}

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

  public globDirs(srcPath: string, prioritize?: string): string[] {
    const unprioritizedDirs = new glob.GlobSync(srcPath + '/**/').found;
    if (prioritize) {
      const notPrioritized: string[] = [];
      const prioritized = unprioritizedDirs.filter(dir => {
        if (dir.includes(prioritize)) {
          return true;
        } else {
          notPrioritized.push(dir);
        }
      });
      return prioritized.concat(notPrioritized);
    }
    return unprioritizedDirs;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ outputdir: string }>
  > {
    const rootPath = vscode.workspace.rootPath ? vscode.workspace.rootPath : '';
    const outputdir = this.explorerDir
      ? this.explorerDir
      : await vscode.window.showQuickPick(
          this.globDirs(rootPath, 'classes'),
          <vscode.QuickPickOptions>{
            placeHolder: nls.localize('force_apex_class_create_enter_dir_name')
          }
        );
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
      if (data != undefined && data.toString() === '0') {
        vscode.workspace
          .openTextDocument(
            response.data.outputdir + '/' + response.data.fileName + '.cls'
          )
          .then(document => vscode.window.showTextDocument(document));
      }
    });

    channelService.streamCommandOutput(execution);
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new SelectFilePath();
const fileNameGatherer = new SelectFileName();

export async function forceApexClassCreate(explorerDir?: any) {
  const outputDirGatherer = new SelectDirPath(explorerDir);
  parameterGatherer.add(fileNameGatherer);
  parameterGatherer.add(outputDirGatherer);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexClassCreateExecutor()
  );
  commandlet.run();
}
